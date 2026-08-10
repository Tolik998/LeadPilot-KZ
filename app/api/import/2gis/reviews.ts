export type Reviews = {
  general_rating?: number | string;
  general_review_count?: number;
  general_review_count_with_stars?: number;
  review_count?: number | string;
};

function finiteNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function reviewStats(reviews?: Reviews) {
  return {
    rating: reviews?.general_rating == null ? null : finiteNumber(reviews.general_rating),
    count: Math.max(
      finiteNumber(reviews?.general_review_count),
      finiteNumber(reviews?.general_review_count_with_stars),
      finiteNumber(reviews?.review_count),
    ),
  };
}
