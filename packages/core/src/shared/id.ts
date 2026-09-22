import { v7 } from "uuid";

export interface IdGenerator {
  next(): string;
}

export const uuidV7Generator: IdGenerator = {
  next: v7,
};
