// docs/ui.md, "Contrat d'API du composant". lg is what every screen drew
// until M6; avatar is the medallion next to a tutor answer.
export type MascotSize = "sm" | "md" | "lg" | "avatar";

const PIXELS: Record<MascotSize, number> = { sm: 64, md: 110, lg: 150, avatar: 40 };

export function sizeProps(size: MascotSize = "lg") {
  return { width: PIXELS[size], height: PIXELS[size], "data-size": size };
}

export type PoseProps = { motion?: "dance"; size?: MascotSize };
