import type {
  InspectEntityReview,
  InspectRiskLevel,
} from "@/lib/inspect-types";

const RISK_ORDER: Record<InspectRiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export function indexInspectReviews(reviews: InspectEntityReview[]) {
  return new Map(reviews.map((review) => [review.entityId, review]));
}

export function getHighestRiskReview(reviews: InspectEntityReview[]) {
  return reviews.reduce<InspectEntityReview | undefined>(
    (highest, review) =>
      !highest ||
      RISK_ORDER[review.riskLevel] > RISK_ORDER[highest.riskLevel]
        ? review
        : highest,
    undefined,
  );
}

export function getHighestFileRiskReview(
  reviews: InspectEntityReview[],
  filePath: string,
) {
  return getHighestRiskReview(
    reviews.filter((review) => review.filePath === filePath),
  );
}

export function formatInspectClassification(classification: string) {
  return classification
    .replace(/([a-z])([A-Z])/g, "$1 + $2")
    .toLowerCase();
}
