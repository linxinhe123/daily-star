import manifest from './generated/national-team-assets.json'

type NationalTeamAsset = {
  src: string
  providerId: string
  team: string
  source: string
}

const assets = manifest.assets as Record<string, NationalTeamAsset>

export const getNationalTeamBadge = (nation: string) => assets[nation]?.src ?? ''
