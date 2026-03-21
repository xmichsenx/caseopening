import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import type { InventoryItem, CaseDefinition, Skin } from "../types";
import { Dashboard } from "../components/Dashboard";
import { Inventory } from "../components/Inventory";
import { CaseSelector } from "../components/CaseSelector";
import { OpeningModal } from "../components/OpeningModal";
import { CaseBattle } from "../components/CaseBattle";
import { SkinRoulette } from "../components/SkinRoulette";
import { Upgrader } from "../components/Upgrader";
import { Crash } from "../components/Crash";
import { getFeaturedSkin } from "../components/CaseSelector";

vi.mock("../audio", () => ({
  playTick: vi.fn(),
  playWinSound: vi.fn(),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      onAnimationComplete,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & {
      onAnimationComplete?: () => void;
    }) => <div {...props}>{children}</div>,
    svg: ({
      children,
      ...props
    }: React.SVGAttributes<SVGSVGElement> & { [key: string]: unknown }) => {
      const { animate, transition, initial, ...rest } = props as Record<
        string,
        unknown
      >;
      return (
        <svg {...(rest as React.SVGAttributes<SVGSVGElement>)}>{children}</svg>
      );
    },
    button: ({
      children,
      ...props
    }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
      [key: string]: unknown;
    }) => {
      const { animate, transition, initial, ...rest } = props as Record<
        string,
        unknown
      >;
      return (
        <button {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}>
          {children}
        </button>
      );
    },
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

// ── Mock Data ──────────────────────────────────────────────

const mockSkin = (overrides: Partial<InventoryItem["skin"]> = {}) => ({
  id: "skin-1",
  name: "AK-47 | Redline",
  description: "A classic skin",
  weapon: { id: "weapon_ak47", name: "AK-47" },
  category: { id: "cat-rifles", name: "Rifles" },
  rarity: { id: "rarity_rare", name: "Classified", color: "#d32ce6" },
  image: "https://example.com/skin.png",
  ...overrides,
});

const mockInventoryItem = (
  overrides: Partial<InventoryItem> = {},
): InventoryItem => ({
  id: "inv-1",
  skin: mockSkin(),
  wonAt: Date.now(),
  sellPrice: 25.5,
  wear: "Field-Tested",
  isStatTrak: false,
  ...overrides,
});

const mockCases: CaseDefinition[] = [
  {
    id: "welcome",
    name: "Welcome Case",
    price: 0,
    image: "https://example.com/welcome.png",
    xpReward: 0,
    description: "Free starter — Blues & Purples only",
    rarityFilter: ["Mil-Spec Grade", "Restricted"],
  },
  {
    id: "dusty-crate",
    name: "Dusty Crate",
    price: 2,
    image: "https://example.com/dusty.png",
    xpReward: 100,
    description: "$2 — Cheap thrills, all weapons",
  },
  {
    id: "pistol-pop",
    name: "Pistol Pop",
    price: 2,
    image: "https://example.com/pistol.png",
    xpReward: 100,
    description: "$2 — Sidearm specials only",
    weaponCategories: ["Pistols"],
  },
];

// ── Dashboard ──────────────────────────────────────────────

describe("Dashboard", () => {
  const defaultProps = {
    balance: 50,
    level: 3,
    xp: 800,
    xpProgress: 0.6,
    totalCasesOpened: 42,
    onReset: vi.fn(),
  };

  it("renders balance correctly", () => {
    render(<Dashboard {...defaultProps} />);
    expect(screen.getByText("$50.00")).toBeInTheDocument();
  });

  it("renders level correctly", () => {
    render(<Dashboard {...defaultProps} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders XP value", () => {
    render(<Dashboard {...defaultProps} />);
    expect(screen.getByText("800 XP")).toBeInTheDocument();
  });

  it("renders cases opened count", () => {
    render(<Dashboard {...defaultProps} />);
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("has a reset button that is clickable", () => {
    const onReset = vi.fn();
    render(<Dashboard {...defaultProps} onReset={onReset} />);
    const resetButton = screen.getByRole("button", { name: /reset/i });
    expect(resetButton).toBeInTheDocument();
    fireEvent.click(resetButton);
    expect(onReset).toHaveBeenCalledOnce();
  });
});

// ── Inventory ──────────────────────────────────────────────

describe("Inventory", () => {
  const onSell = vi.fn();

  it('renders "Your inventory is empty" when items is empty', () => {
    render(<Inventory items={[]} onSell={onSell} />);
    expect(screen.getByText("Your inventory is empty")).toBeInTheDocument();
  });

  it("renders items with their sell prices", () => {
    const items = [
      mockInventoryItem({ id: "inv-1", sellPrice: 25.5 }),
      mockInventoryItem({
        id: "inv-2",
        sellPrice: 100.0,
        skin: mockSkin({ id: "skin-2", name: "M4A4 | Howl" }),
      }),
    ];
    render(<Inventory items={items} onSell={onSell} />);
    expect(screen.getByText("$25.50")).toBeInTheDocument();
    expect(screen.getByText("$100.00")).toBeInTheDocument();
  });

  it("has sell buttons in the DOM for each item", () => {
    const items = [
      mockInventoryItem({ id: "inv-1" }),
      mockInventoryItem({ id: "inv-2", skin: mockSkin({ id: "skin-2" }) }),
    ];
    render(<Inventory items={items} onSell={onSell} />);
    const sellButtons = screen.getAllByRole("button", { name: /sell/i });
    expect(sellButtons).toHaveLength(2);
  });

  it("calls onSell with item id when sell button is clicked", () => {
    const sellFn = vi.fn();
    const items = [mockInventoryItem({ id: "item-abc" })];
    render(<Inventory items={items} onSell={sellFn} />);
    const sellButton = screen.getByRole("button", { name: /sell/i });
    fireEvent.click(sellButton);
    expect(sellFn).toHaveBeenCalledWith("item-abc");
  });

  it("has sort buttons", () => {
    render(<Inventory items={[mockInventoryItem()]} onSell={onSell} />);
    expect(screen.getByRole("button", { name: /newest/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /price ↓/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /price ↑/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /rarity/i })).toBeInTheDocument();
  });
});

// ── CaseSelector ───────────────────────────────────────────

describe("CaseSelector", () => {
  const defaultProps = {
    cases: mockCases,
    selectedCase: null,
    onSelectCase: vi.fn(),
    balance: 10,
    level: 99,
    skins: [] as import("../types").Skin[],
  };

  it("renders all cases", () => {
    render(<CaseSelector {...defaultProps} />);
    expect(screen.getByText("Welcome Case")).toBeInTheDocument();
    expect(screen.getByText("Dusty Crate")).toBeInTheDocument();
    expect(screen.getByText("Pistol Pop")).toBeInTheDocument();
  });

  it('shows "FREE" for free cases', () => {
    render(<CaseSelector {...defaultProps} />);
    expect(screen.getByText("FREE")).toBeInTheDocument();
  });

  it("shows price for paid cases", () => {
    render(<CaseSelector {...defaultProps} />);
    const priceElements = screen.getAllByText("$2");
    expect(priceElements).toHaveLength(2);
  });

  it("highlights the selected case", () => {
    render(<CaseSelector {...defaultProps} selectedCase={mockCases[1]} />);
    // The selected case should have the checkmark indicator
    expect(screen.getByText("✓")).toBeInTheDocument();
  });

  it("calls onSelectCase when a case is clicked", () => {
    const onSelectCase = vi.fn();
    render(<CaseSelector {...defaultProps} onSelectCase={onSelectCase} />);
    fireEvent.click(screen.getByText("Welcome Case"));
    expect(onSelectCase).toHaveBeenCalledWith(mockCases[0]);
  });

  it("disables cases the user cannot afford", () => {
    render(<CaseSelector {...defaultProps} balance={0} />);
    // The free case should still be enabled
    const buttons = screen.getAllByRole("button");
    const freeButton = buttons.find((b) =>
      b.textContent?.includes("Welcome Case"),
    )!;
    expect(freeButton).not.toBeDisabled();
    // Paid cases should be disabled
    const dustyButton = buttons.find((b) =>
      b.textContent?.includes("Dusty Crate"),
    )!;
    expect(dustyButton).toBeDisabled();
  });
});

// ── OpeningModal ───────────────────────────────────────────

const makeSkin = (
  id: string = "skin-1",
  name: string = "AK-47 | Redline",
): Skin => ({
  id,
  name,
  description: "Test skin",
  weapon: { id: "weapon_ak47", name: "AK-47" },
  category: { id: "cat-rifles", name: "Rifles" },
  rarity: { id: "rarity_rare", name: "Classified", color: "#d32ce6" },
  image: "https://example.com/skin.png",
});

const makeStrip = (): Skin[] =>
  Array.from({ length: 50 }, (_, i) => makeSkin(`skin-${i}`));

describe("OpeningModal", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    strips: [makeStrip()],
    onAllSpinsComplete: vi.fn(),
    caseName: "Test Case",
    caseImage: "https://example.com/case.png",
  };

  it("renders when isOpen is true", () => {
    render(<OpeningModal {...defaultProps} />);
    expect(screen.getByText("Test Case")).toBeInTheDocument();
  });

  it("does not render when isOpen is false", () => {
    render(<OpeningModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText("Test Case")).not.toBeInTheDocument();
  });

  it("shows quantity badge for multi-open", () => {
    render(
      <OpeningModal
        {...defaultProps}
        strips={[makeStrip(), makeStrip(), makeStrip()]}
      />,
    );
    expect(screen.getByText("×3")).toBeInTheDocument();
  });
});

// ── CaseBattle ─────────────────────────────────────────────

describe("CaseBattle", () => {
  const testCase: CaseDefinition = {
    id: "dusty-crate",
    name: "Dusty Crate",
    price: 2,
    image: "https://example.com/dusty.png",
    xpReward: 100,
    description: "$2 — Cheap thrills, all weapons",
  };

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    selectedCase: testCase,
    skins: Array.from({ length: 100 }, (_, i) =>
      makeSkin(`skin-${i}`, `Skin ${i}`),
    ),
    onBattleComplete: vi.fn(),
    balance: 100,
  };

  it("renders setup screen when open", () => {
    render(<CaseBattle {...defaultProps} />);
    expect(screen.getByText("⚔️ Case Battle")).toBeInTheDocument();
  });

  it("does not render when isOpen is false", () => {
    render(<CaseBattle {...defaultProps} isOpen={false} />);
    expect(screen.queryByText("⚔️ Case Battle")).not.toBeInTheDocument();
  });

  it("shows bot count selector buttons", () => {
    render(<CaseBattle {...defaultProps} />);
    expect(screen.getByText("1 vs 1")).toBeInTheDocument();
    expect(screen.getByText("1 vs 2")).toBeInTheDocument();
    expect(screen.getByText("1 vs 3")).toBeInTheDocument();
  });

  it("shows player cost regardless of bot count", () => {
    render(<CaseBattle {...defaultProps} />);
    // Player only pays for their own case: $2.00
    expect(screen.getByText("$2.00")).toBeInTheDocument();
    // Click 1v3 — cost stays the same (bots pay for themselves)
    fireEvent.click(screen.getByText("1 vs 3"));
    expect(screen.getByText("$2.00")).toBeInTheDocument();
  });

  it("disables start when balance insufficient", () => {
    render(<CaseBattle {...defaultProps} balance={0} />);
    const startButton = screen.getByText("Start Battle");
    expect(startButton).toBeDisabled();
  });

  it("shows FREE for free cases", () => {
    const freeCase: CaseDefinition = {
      id: "welcome",
      name: "Welcome",
      price: 0,
      image: "",
      xpReward: 0,
      description: "Free case",
    };
    render(
      <CaseBattle {...defaultProps} selectedCase={freeCase} balance={0} />,
    );
    expect(screen.getByText("FREE")).toBeInTheDocument();
  });
});

// ── getFeaturedSkin ────────────────────────────────────────

describe("getFeaturedSkin", () => {
  const makeSkinWithRarity = (id: string, rarityName: string): Skin => ({
    id,
    name: `Skin ${id}`,
    description: "Test",
    weapon: { id: "w1", name: "AK-47" },
    category: { id: "c1", name: "Rifles" },
    rarity: { id: `r-${rarityName}`, name: rarityName, color: "#fff" },
    image: `https://example.com/${id}.png`,
  });

  it("picks a skin whose rarity is inside the rarityFilter", () => {
    const skins: Skin[] = [
      makeSkinWithRarity("blue-1", "Mil-Spec Grade"),
      makeSkinWithRarity("purple-1", "Restricted"),
      makeSkinWithRarity("red-1", "Covert"),
    ];
    const welcomeCase: CaseDefinition = {
      id: "welcome",
      name: "Welcome Case",
      price: 0,
      image: "",
      xpReward: 0,
      description: "Blues & Purples only",
      rarityFilter: ["Mil-Spec Grade", "Restricted"],
    };
    const result = getFeaturedSkin(welcomeCase, skins);
    expect(result).not.toBeNull();
    expect(["Mil-Spec Grade", "Restricted"]).toContain(result!.rarity.name);
  });

  it("returns null for empty skins array", () => {
    const c: CaseDefinition = {
      id: "test",
      name: "Test",
      price: 0,
      image: "",
      xpReward: 0,
      description: "",
    };
    expect(getFeaturedSkin(c, [])).toBeNull();
  });
});

// ── SkinRoulette ───────────────────────────────────────────

describe("SkinRoulette", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    inventory: [
      mockInventoryItem({ id: "inv-1", sellPrice: 10 }),
      mockInventoryItem({
        id: "inv-2",
        sellPrice: 20,
        skin: mockSkin({ id: "skin-2", name: "M4A4 | Howl" }),
      }),
      mockInventoryItem({
        id: "inv-3",
        sellPrice: 50,
        skin: mockSkin({ id: "skin-3", name: "AWP | Dragon Lore" }),
      }),
    ],
    onRemoveItems: vi.fn(),
    onAddBalance: vi.fn(),
    onAddXp: vi.fn(),
  };

  it("renders when isOpen is true", () => {
    render(<SkinRoulette {...defaultProps} />);
    expect(screen.getByText("Skin Roulette")).toBeInTheDocument();
  });

  it("does not render when isOpen is false", () => {
    render(<SkinRoulette {...defaultProps} isOpen={false} />);
    expect(screen.queryByText("Skin Roulette")).not.toBeInTheDocument();
  });

  it("shows inventory items as selectable buttons", () => {
    render(<SkinRoulette {...defaultProps} />);
    expect(screen.getByText("$10.00")).toBeInTheDocument();
    expect(screen.getByText("$20.00")).toBeInTheDocument();
    expect(screen.getByText("$50.00")).toBeInTheDocument();
  });

  it("shows empty state when inventory is empty", () => {
    render(<SkinRoulette {...defaultProps} inventory={[]} />);
    expect(screen.getByText("Inventory empty")).toBeInTheDocument();
  });

  it("shows three color buttons (red, black, green)", () => {
    render(<SkinRoulette {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: /^red7\/15/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^black7\/15/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^green1\/15/i }),
    ).toBeInTheDocument();
  });

  it("disables spin when no skins are selected", () => {
    render(<SkinRoulette {...defaultProps} />);
    const spinBtn = screen.getByText("Select skins to bet");
    expect(spinBtn).toBeDisabled();
  });

  it("updates selected count after selecting a skin", () => {
    render(<SkinRoulette {...defaultProps} />);
    // Click the first skin button
    const skinButtons = screen
      .getAllByRole("button")
      .filter((b) => b.textContent?.includes("$10.00"));
    fireEvent.click(skinButtons[0]);
    expect(screen.getByText("1 selected")).toBeInTheDocument();
  });

  it("has select-all and clear buttons", () => {
    render(<SkinRoulette {...defaultProps} />);
    expect(screen.getByRole("button", { name: /^all$/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^clear$/i }),
    ).toBeInTheDocument();
  });
});

// ── Upgrader ───────────────────────────────────────────────

describe("Upgrader", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    inventory: [
      mockInventoryItem({ id: "inv-1", sellPrice: 10 }),
      mockInventoryItem({
        id: "inv-2",
        sellPrice: 20,
        skin: mockSkin({ id: "skin-2", name: "M4A4 | Howl" }),
      }),
      mockInventoryItem({
        id: "inv-3",
        sellPrice: 50,
        skin: mockSkin({ id: "skin-3", name: "AWP | Dragon Lore" }),
      }),
    ],
    onRemoveItems: vi.fn(),
    onAddBalance: vi.fn(),
    onAddXp: vi.fn(),
  };

  it("renders when isOpen is true", () => {
    render(<Upgrader {...defaultProps} />);
    expect(screen.getByText("Upgrader")).toBeInTheDocument();
  });

  it("does not render when isOpen is false", () => {
    render(<Upgrader {...defaultProps} isOpen={false} />);
    expect(screen.queryByText("Upgrader")).not.toBeInTheDocument();
  });

  it("shows inventory items as selectable buttons", () => {
    render(<Upgrader {...defaultProps} />);
    expect(screen.getByText("$10.00")).toBeInTheDocument();
    expect(screen.getByText("$20.00")).toBeInTheDocument();
    expect(screen.getByText("$50.00")).toBeInTheDocument();
  });

  it("shows empty state when inventory is empty", () => {
    render(<Upgrader {...defaultProps} inventory={[]} />);
    expect(screen.getByText("Inventory empty")).toBeInTheDocument();
  });

  it("shows multiplier preset buttons", () => {
    render(<Upgrader {...defaultProps} />);
    expect(screen.getAllByText("2×").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("5×").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("10×").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("25×").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("50×").length).toBeGreaterThanOrEqual(1);
  });

  it("shows the default success chance for 2× multiplier", () => {
    render(<Upgrader {...defaultProps} />);
    // 2× => (1/2) * 0.95 * 100 = 47.5%
    expect(screen.getAllByText("47.5%").length).toBeGreaterThanOrEqual(1);
  });

  it("disables upgrade button when no skin is selected", () => {
    render(<Upgrader {...defaultProps} />);
    const btn = screen.getByText("Select a skin");
    expect(btn).toBeDisabled();
  });

  it("shows select a skin placeholder when nothing selected", () => {
    render(<Upgrader {...defaultProps} />);
    expect(screen.getByText("Select a skin to upgrade")).toBeInTheDocument();
  });

  it("displays target value after selecting a skin", () => {
    render(<Upgrader {...defaultProps} />);
    // Click the $50.00 skin (AWP | Dragon Lore)
    const skinButtons = screen
      .getAllByRole("button")
      .filter((b) => b.textContent?.includes("$50.00"));
    fireEvent.click(skinButtons[0]);
    // 50 * 2 = $100.00 target — shown in info card and stats
    expect(screen.getAllByText("$100.00").length).toBeGreaterThanOrEqual(1);
  });
});

// ── Crash ───────────────────────────────────────────────────────

describe("Crash", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    balance: 100,
    onSpendBalance: vi.fn(() => true),
    onAddBalance: vi.fn(),
    onAddXp: vi.fn(),
  };

  it("renders when isOpen is true", () => {
    render(<Crash {...defaultProps} />);
    expect(screen.getByText("Crash")).toBeInTheDocument();
  });

  it("does not render when isOpen is false", () => {
    render(<Crash {...defaultProps} isOpen={false} />);
    expect(screen.queryByText("Crash")).not.toBeInTheDocument();
  });

  it("shows balance in the header", () => {
    render(<Crash {...defaultProps} balance={42.5} />);
    expect(screen.getByText("$42.50")).toBeInTheDocument();
  });

  it("shows quick bet buttons", () => {
    render(<Crash {...defaultProps} />);
    expect(screen.getByText("$1")).toBeInTheDocument();
    expect(screen.getByText("$5")).toBeInTheDocument();
    expect(screen.getByText("$10")).toBeInTheDocument();
    expect(screen.getByText("$25")).toBeInTheDocument();
    expect(screen.getByText("$50")).toBeInTheDocument();
  });

  it("shows auto cashout presets", () => {
    render(<Crash {...defaultProps} />);
    expect(screen.getByText("1.5×")).toBeInTheDocument();
    expect(screen.getByText("2×")).toBeInTheDocument();
    expect(screen.getByText("3×")).toBeInTheDocument();
    expect(screen.getByText("5×")).toBeInTheDocument();
    expect(screen.getByText("10×")).toBeInTheDocument();
  });

  it("shows Place your bet text in idle state", () => {
    render(<Crash {...defaultProps} />);
    expect(screen.getByText("Place your bet")).toBeInTheDocument();
  });

  it("disables bet when balance is 0", () => {
    render(<Crash {...defaultProps} balance={0} />);
    const betButton = screen.getByText("Insufficient balance");
    expect(betButton).toBeDisabled();
  });

  it("shows house edge and max info", () => {
    render(<Crash {...defaultProps} />);
    expect(screen.getByText("House edge: 2%")).toBeInTheDocument();
    expect(screen.getByText("Max: 100×")).toBeInTheDocument();
  });

  it("calls onSpendBalance when bet button is clicked", () => {
    const onSpend = vi.fn(() => true);
    render(<Crash {...defaultProps} onSpendBalance={onSpend} />);
    const betButton = screen.getByText("Bet $5.00");
    fireEvent.click(betButton);
    expect(onSpend).toHaveBeenCalledWith(5);
  });

  it("sets bet amount via quick bet buttons", () => {
    render(<Crash {...defaultProps} />);
    fireEvent.click(screen.getByText("$25"));
    expect(screen.getByText("Bet $25.00")).toBeInTheDocument();
  });
});
