export const DEFAULT_DENOMINATIONS = [
  1,
  5,
  25,
  100,
  500,
  1_000,
  5_000,
  10_000
] as const;

export interface ThemePalette {
  canvas: string;
  surface: string;
  surfaceRaised: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
  border: string;
  accent: string;
  accentHover: string;
  accentPressed: string;
  accentText: string;
  danger: string;
  dangerHover: string;
  dangerPressed: string;
  dangerText: string;
  success: string;
  warning: string;
  focus: string;
  shadow: string;
  table: string;
  tableRail: string;
  tableText: string;
}

export interface ProductConfig {
  avatars: {
    selectable: readonly string[];
    fallback: string;
  };
  themes: {
    main: {
      light: ThemePalette;
      dark: ThemePalette;
    };
    poker: {
      light: ThemePalette;
      dark: ThemePalette;
    };
    avalon: {
      light: ThemePalette;
      dark: ThemePalette;
    };
  };
  suits: {
    standard: Record<"clubs" | "diamonds" | "hearts" | "spades", string>;
    "high-contrast": Record<"clubs" | "diamonds" | "hearts" | "spades", string>;
  };
  chips: {
    colors: readonly string[];
    edge: string;
    textLight: string;
    textDark: string;
  };
}

const productConfigValue = {
  avatars: {
    selectable: [
      "🦊",
      "🐼",
      "🐯",
      "🐸",
      "🐙",
      "🦁",
      "🐧",
      "🦄",
      "🐨",
      "🐵",
      "🐶",
      "🐱",
      "🐰",
      "🐹",
      "🐻",
      "🐮",
      "🐷",
      "🐔",
      "🦉",
      "🦋",
      "🐝",
      "🐳",
      "🐬",
      "🦖",
      "🐲",
      "🦝",
      "🦦",
      "🦥",
      "🐺",
      "🦅",
      "🐢",
      "🦜"
    ],
    fallback: "🙂"
  },
  themes: {
    main: {
      light: {
        canvas: "#f5f1eb",
        surface: "#fffdf9",
        surfaceRaised: "#ffffff",
        surfaceMuted: "#eee8df",
        text: "#26222d",
        textMuted: "#6f6877",
        border: "#d9d0c5",
        accent: "#6750a4",
        accentHover: "#755db5",
        accentPressed: "#563f91",
        accentText: "#ffffff",
        danger: "#b43b4d",
        dangerHover: "#c8495a",
        dangerPressed: "#982e3f",
        dangerText: "#ffffff",
        success: "#2f7d68",
        warning: "#a86419",
        focus: "#3568c8",
        shadow: "rgba(55, 45, 72, 0.18)",
        table: "#e6dfd5",
        tableRail: "#c9bbaa",
        tableText: "#26222d"
      },
      dark: {
        canvas: "#18161d",
        surface: "#242129",
        surfaceRaised: "#2d2933",
        surfaceMuted: "#35303b",
        text: "#f4eef7",
        textMuted: "#b9afc0",
        border: "#4a424f",
        accent: "#b8a2ff",
        accentHover: "#c7b5ff",
        accentPressed: "#9e83ef",
        accentText: "#211838",
        danger: "#ef8190",
        dangerHover: "#ff95a3",
        dangerPressed: "#d9697a",
        dangerText: "#301017",
        success: "#74cdb3",
        warning: "#e5ae67",
        focus: "#8cb4ff",
        shadow: "rgba(0, 0, 0, 0.42)",
        table: "#312c37",
        tableRail: "#514759",
        tableText: "#f4eef7"
      }
    },
    poker: {
      light: {
        canvas: "#122a22",
        surface: "#17392d",
        surfaceRaised: "#1e4738",
        surfaceMuted: "#285343",
        text: "#f7f0d7",
        textMuted: "#c9d6c6",
        border: "#4f745f",
        accent: "#d7ad54",
        accentHover: "#e6bd66",
        accentPressed: "#bd9340",
        accentText: "#2a210d",
        danger: "#c65353",
        dangerHover: "#d96767",
        dangerPressed: "#a94141",
        dangerText: "#ffffff",
        success: "#78c99f",
        warning: "#e1a94f",
        focus: "#f4d37c",
        shadow: "rgba(0, 0, 0, 0.36)",
        table: "#146044",
        tableRail: "#533b29",
        tableText: "#fff8dc"
      },
      dark: {
        canvas: "#09130f",
        surface: "#10251d",
        surfaceRaised: "#173329",
        surfaceMuted: "#204238",
        text: "#f3ecd5",
        textMuted: "#aabbb0",
        border: "#365648",
        accent: "#e0b85e",
        accentHover: "#f0ca70",
        accentPressed: "#c59c45",
        accentText: "#251c09",
        danger: "#e06f70",
        dangerHover: "#f38283",
        dangerPressed: "#c45a5c",
        dangerText: "#2b0d0e",
        success: "#75caa2",
        warning: "#e4ae55",
        focus: "#f0cf75",
        shadow: "rgba(0, 0, 0, 0.56)",
        table: "#0d4b35",
        tableRail: "#38271d",
        tableText: "#fff5cf"
      }
    },
    avalon: {
      light: {
        canvas: "#eef2fb",
        surface: "#f8f9ff",
        surfaceRaised: "#ffffff",
        surfaceMuted: "#e3eaf7",
        text: "#1c2744",
        textMuted: "#5c6987",
        border: "#c4cfe3",
        accent: "#126f6a",
        accentHover: "#16857d",
        accentPressed: "#0b5955",
        accentText: "#ffffff",
        danger: "#b63f55",
        dangerHover: "#c94d63",
        dangerPressed: "#982f45",
        dangerText: "#ffffff",
        success: "#23765f",
        warning: "#9a6200",
        focus: "#265fa9",
        shadow: "rgba(35, 50, 88, 0.18)",
        table: "#dce5f5",
        tableRail: "#aab9d5",
        tableText: "#1c2744"
      },
      dark: {
        canvas: "#090f1f",
        surface: "#111b31",
        surfaceRaised: "#192744",
        surfaceMuted: "#223353",
        text: "#f3f5ff",
        textMuted: "#b7c2df",
        border: "#3a4c72",
        accent: "#65d7cd",
        accentHover: "#7be4dc",
        accentPressed: "#4cc0b5",
        accentText: "#082725",
        danger: "#f08498",
        dangerHover: "#ff9bae",
        dangerPressed: "#d96f84",
        dangerText: "#351018",
        success: "#75d5ae",
        warning: "#f0b95f",
        focus: "#91b9ff",
        shadow: "rgba(0, 0, 0, 0.52)",
        table: "#0d1730",
        tableRail: "#263b64",
        tableText: "#f3f5ff"
      }
    }
  },
  suits: {
    standard: {
      clubs: "#20242a",
      diamonds: "#c84747",
      hearts: "#c84747",
      spades: "#20242a"
    },
    "high-contrast": {
      clubs: "#16794f",
      diamonds: "#1768c5",
      hearts: "#d22f45",
      spades: "#20242a"
    }
  },
  chips: {
    colors: [
      "#f3f0e9",
      "#d65050",
      "#3c73bd",
      "#3c9568",
      "#4b4b55",
      "#9f5cba",
      "#d69b3d",
      "#2a9aa0",
      "#bd6c40",
      "#7b8798",
      "#d36f9a",
      "#6f9851",
      "#8269c0",
      "#c0a13f",
      "#5a87aa",
      "#9c665f"
    ],
    edge: "#f7e8ba",
    textLight: "#ffffff",
    textDark: "#17151a"
  }
} as const satisfies ProductConfig;

function assertProductConfig(config: ProductConfig): void {
  const avatars = config.avatars.selectable;
  if (
    avatars.length < 24 ||
    new Set(avatars).size !== avatars.length ||
    avatars.some((avatar) => [...avatar].length === 0 || [...avatar].length > 8) ||
    avatars.includes(config.avatars.fallback)
  ) {
    throw new Error("INVALID_AVATAR_CONFIG");
  }
  const palettes = [
    config.themes.main.light,
    config.themes.main.dark,
    config.themes.poker.light,
    config.themes.poker.dark,
    config.themes.avalon.light,
    config.themes.avalon.dark
  ];
  if (
    palettes.some((palette) =>
      Object.values(palette).some(
        (value) => typeof value !== "string" || value.trim().length === 0
      )
    )
  ) {
    throw new Error("INVALID_THEME_CONFIG");
  }
  if (
    config.chips.colors.length === 0 ||
    new Set(config.chips.colors).size !== config.chips.colors.length
  ) {
    throw new Error("INVALID_CHIP_CONFIG");
  }
}

assertProductConfig(productConfigValue);

export const productConfig: ProductConfig = productConfigValue;
export const selectableAvatars = productConfig.avatars.selectable;
export const fallbackAvatar = productConfig.avatars.fallback;

export function isSelectableAvatar(avatar: string): boolean {
  return selectableAvatars.includes(avatar);
}
