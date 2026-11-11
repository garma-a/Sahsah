export const isPosition = (value: number) => Number.isInteger(value) && value >= 1 && value <= 6;
export const isPointStage = (value: number) => Number.isInteger(value) && value >= 0 && value <= 2;
