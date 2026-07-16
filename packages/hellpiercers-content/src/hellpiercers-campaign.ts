import type { CampaignContribution } from "@gaem/shared";

export function hellpiercersCampaign(): CampaignContribution {
  return {
    regionFactions: {
      west: "syncrasis",
      center: "autophyes",
      east: "paracletus",
    },
    partyResourceKeys: ["hellsteel", "soulfire", "brimstone"],
    partyResourceLabels: {
      hellsteel: "Hellsteel",
      soulfire: "Soulfire",
      brimstone: "Brimstone",
    },
    defaultPartyResources: {
      hellsteel: 0,
      soulfire: 0,
      brimstone: 0,
    },
    starterUnlocks: {
      weapons: [
        "Ten Thousand Year Reign Shattering Blade",
        "She Speaks The Language Of Kings",
        "Sethian Externalized Annihilation Cannon",
      ],
      armor: ["MALAKBEL", "KUSHIEL", "ASMODEL"],
      classes: ["HARPE", "KOPIS", "SHARUR"],
      equipment: [],
      gear: [],
      haloSystems: [],
    },
    upgradeFeatures: {
      "ignorance-devouring-anchor": ["reversals"],
      "ancilia-tactical-production": ["equipmentSlot"],
      "pronoia-arms-modification": ["gearSlot"],
      "choic-spatial-manipulation": ["secondWeaponSlot"],
      "synthetic-spinther-manufacturing": ["vehicles"],
      "hebdomas-aerial-support": ["offGridMunitions"],
      "archontic-pneuma-engineering-bay": ["haloUnits"],
      "aponoia-expedited-enlightenment": ["limitBreak"],
      "syzygos-automated-adulation": ["roles"],
      "agnoia-triumph-chamber": ["triumph"],
      "eros-management-vault": ["legendaryArms"],
      "gnostic-synthesis-chamber": ["crossClassDevelopment"],
      "anoint-reality-manipulation": ["preBattleGridManipulation"],
    },
    overworldGeometry: { width: 17, height: 11, travelFuelCost: 2 },
    classRules: {
      secondWeaponClasses: ["HARPE"],
      dualGearClasses: ["EPEUS"],
    },
  };
}
