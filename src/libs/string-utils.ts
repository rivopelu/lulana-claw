import { randomUUIDv7 } from "bun";

export function generateId(): string {
  return randomUUIDv7().split("-").join("").toUpperCase();
}

export function generateProfilePicture(name: string): string {
  return `https://ui-avatars.com/api/?name=${name}&background=random`;
}
