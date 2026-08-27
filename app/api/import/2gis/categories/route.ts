type ApiMeta = {
  code?: number;
  error?: { message?: string; type?: string };
};

type Region = {
  id?: string | number;
  name?: string;
};

type Rubric = {
  id?: string | number;
  name?: string;
  title?: string;
  keyword?: string;
  type?: string;
  rubrics?: Rubric[];
};

type RegionResponse = {
  meta?: ApiMeta;
  result?: { items?: Region[] };
};

type RubricResponse = {
  meta?: ApiMeta;
  result?: { items?: Rubric[]; total?: number };
};

type JsonResponse<T> = {
  response: Response;
  data: T;
};

const TWO_GIS_TIMEOUT_MS = 20_000;
const TWO_GIS_MAX_ATTEMPTS = 2;
const RUBRIC_PAGE_SIZE = 50;
const RUBRIC_MAX_PAGES = 100;

class TwoGisTransportError extends Error {}

async function fetch2GisJson<T>(url: URL): Promise<JsonResponse<T>> {
  for (let attempt = 1; attempt <= TWO_GIS_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "identity",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(TWO_GIS_TIMEOUT_MS),
      });
      const body = await response.text();
      const data = JSON.parse(body) as T;
      return { response, data };
    } catch {
      if (attempt < TWO_GIS_MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
  }

  throw new TwoGisTransportError(
    "2ГИС прервал загрузку справочника категорий. Повторите попытку через несколько секунд.",
  );
}

function apiError(meta: ApiMeta | undefined, fallback: string) {
  const original = meta?.error?.message?.trim();
  if (meta?.code === 403 || /access|forbidden|denied/i.test(original || "")) {
    return "Ключу 2ГИС нужен доступ к Regions API и Categories API, чтобы загрузить полный справочник рубрик.";
  }
  return original || fallback;
}

function rubricName(rubric: Rubric) {
  return (rubric.name || rubric.title || rubric.keyword || "").trim();
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { apiKey?: string; city?: string };
    const apiKey = payload.apiKey?.trim();
    const city = payload.city?.trim().slice(0, 100);
    if (!apiKey) {
      return Response.json({ error: "Укажите API-ключ 2ГИС" }, { status: 400 });
    }
    if (!city) {
      return Response.json({ error: "Укажите город" }, { status: 400 });
    }

    const regionUrl = new URL("https://catalog.api.2gis.com/2.0/region/search");
    regionUrl.searchParams.set("q", city);
    regionUrl.searchParams.set("locale", "ru_KZ");
    regionUrl.searchParams.set("key", apiKey);
    const { response: regionResponse, data: regionData } =
      await fetch2GisJson<RegionResponse>(regionUrl);
    if (!regionResponse.ok || regionData.meta?.code !== 200) {
      return Response.json(
        { error: apiError(regionData.meta, "2ГИС не смог определить регион для выбранного города") },
        { status: regionResponse.status >= 400 ? regionResponse.status : 502 },
      );
    }
    const region = regionData.result?.items?.[0];
    const regionId = String(region?.id || "");
    if (!/^\d+$/.test(regionId)) {
      return Response.json(
        { error: `2ГИС не нашёл регион для города «${city}»` },
        { status: 404 },
      );
    }

    const rubricUrl = new URL("https://catalog.api.2gis.com/2.0/catalog/rubric/list");
    rubricUrl.searchParams.set("region_id", regionId);
    rubricUrl.searchParams.set("fields", "items.rubrics");
    rubricUrl.searchParams.set("page_size", String(RUBRIC_PAGE_SIZE));
    rubricUrl.searchParams.set("sort", "name");
    rubricUrl.searchParams.set("locale", "ru_KZ");
    rubricUrl.searchParams.set("key", apiKey);
    const rubricGroups: Rubric[] = [];
    for (let page = 1; page <= RUBRIC_MAX_PAGES; page += 1) {
      rubricUrl.searchParams.set("page", String(page));
      const { response: rubricResponse, data: rubricData } =
        await fetch2GisJson<RubricResponse>(rubricUrl);
      if (!rubricResponse.ok || rubricData.meta?.code !== 200) {
        return Response.json(
          { error: apiError(rubricData.meta, "2ГИС не вернул список категорий") },
          { status: rubricResponse.status >= 400 ? rubricResponse.status : 502 },
        );
      }

      const pageItems = rubricData.result?.items || [];
      rubricGroups.push(...pageItems);
      const total = rubricData.result?.total;
      if (
        pageItems.length < RUBRIC_PAGE_SIZE ||
        (typeof total === "number" && rubricGroups.length >= total)
      ) {
        break;
      }
      if (page === RUBRIC_MAX_PAGES) {
        throw new Error("2ГИС вернул слишком большой справочник категорий");
      }
    }

    const unique = new Map<
      string,
      { id: string; name: string; parentName: string }
    >();
    for (const group of rubricGroups) {
      const parentName = rubricName(group);
      const children = Array.isArray(group.rubrics) ? group.rubrics : [];
      const rubrics = children.length ? children : group.type === "rubric" ? [group] : [];
      for (const rubric of rubrics) {
        const id = String(rubric.id || "");
        const name = rubricName(rubric);
        if (/^\d+$/.test(id) && name) {
          unique.set(id, { id, name, parentName: children.length ? parentName : "" });
        }
      }
    }
    const categories = [...unique.values()].sort((left, right) =>
      left.name.localeCompare(right.name, "ru"),
    );

    return Response.json({
      city: region?.name || city,
      regionId,
      categories,
      total: categories.length,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof TwoGisTransportError
            ? error.message
            : error instanceof Error
            ? error.message
            : "Не удалось загрузить категории 2ГИС",
      },
      { status: error instanceof TwoGisTransportError ? 502 : 500 },
    );
  }
}
