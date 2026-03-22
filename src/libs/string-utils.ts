import { randomUUID } from "crypto";

export function generateId(): string {
  return randomUUID().split("-").join("").toUpperCase();
}

export function generateProfilePicture(name: string): string {
  return `https://ui-avatars.com/api/?name=${name}&background=random`;
}
