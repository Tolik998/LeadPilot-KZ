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
  result?: { items?: Rubric[] };
};

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
    const regionResponse = await fetch(regionUrl, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const regionData = (await regionResponse.json()) as RegionResponse;
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
    rubricUrl.searchParams.set("page_size", "10000");
    rubricUrl.searchParams.set("sort", "name");
    rubricUrl.searchParams.set("locale", "ru_KZ");
    rubricUrl.searchParams.set("key", apiKey);
    const rubricResponse = await fetch(rubricUrl, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const rubricData = (await rubricResponse.json()) as RubricResponse;
    if (!rubricResponse.ok || rubricData.meta?.code !== 200) {
      return Response.json(
        { error: apiError(rubricData.meta, "2ГИС не вернул список категорий") },
        { status: rubricResponse.status >= 400 ? rubricResponse.status : 502 },
      );
    }

    const unique = new Map<
      string,
      { id: string; name: string; parentName: string }
    >();
    for (const group of rubricData.result?.items || []) {
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
          error instanceof Error
            ? error.message
            : "Не удалось загрузить категории 2ГИС",
      },
      { status: 500 },
    );
  }
}
