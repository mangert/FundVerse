// 🔹 Сервис получения токенов теперь работает напрямую с The Graph
import { zeroAddress } from "viem";
import { BASE_TOKENS, type TokenConfig } from "../config/tokens";

export interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
  status: boolean;
}

class TokenService {
  private static instance: TokenService;
  private tokens: Map<string, TokenInfo> = new Map();
  private pollingInterval: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL = 30_000; // 30 секунд

  private readonly chainId: number;
  private readonly nativeToken: TokenInfo;
  private readonly graphUrl: string;

  private constructor() {
    // Определяем сеть (по умолчанию — Sepolia)
    this.chainId = Number(import.meta.env.VITE_CHAIN_ID || 11155111);

    // Загружаем конфигурацию сети
    const config = BASE_TOKENS[this.chainId];
    if (!config) {
      throw new Error(`No token configuration found for chain ${this.chainId}`);
    }

    // Нативный токен из конфига (ETH / Sepolia ETH / HETH)
    this.nativeToken = {
      address: zeroAddress,
      symbol: config.native.symbol,
      decimals: config.native.decimals,
      name: config.native.name,
      status: true,
    };

    // URL сабграфа для текущей сети
    this.graphUrl =
      import.meta.env.VITE_GRAPHQL_API_URL ||
      "https://api.studio.thegraph.com/query/121375/fund-verse/v0.0.3";
  }

  static getInstance(): TokenService {
    if (!TokenService.instance) {
      TokenService.instance = new TokenService();
    }
    return TokenService.instance;
  }

  /** 🔹 Инициализация сервиса — сначала подгружаем конфиг, потом данные из сабграфа */
  async init() {
    console.log("🪙 Initializing TokenService via The Graph...");

    try {
      this.loadPresetTokens(); // подгружаем токены из BASE_TOKENS
      await this.fetchTokensFromGraph(); // затем обновляем из сабграфа
      this.startPolling(); // и включаем периодическую подгрузку
      console.log("✅ TokenService initialized successfully");
    } catch (error) {
      console.error("❌ Failed to initialize TokenService:", error);
    }
  }

  /** 🔹 Подгрузка предустановленных токенов из конфига */
  private loadPresetTokens() {
    const config = BASE_TOKENS[this.chainId];
    this.tokens.clear();

    // Добавляем нативный токен
    this.tokens.set(zeroAddress, this.nativeToken);

    // Добавляем предустановленные токены
    config.tokens.forEach((t: TokenConfig) => {
      this.tokens.set(t.address.toLowerCase(), {
        address: t.address,
        symbol: t.symbol,
        decimals: t.decimals,
        name: t.name,
        status: t.status,
      });
    });

    console.log(`🔸 Loaded ${config.tokens.length} preset tokens for chain ${this.chainId}`);
  }

  /** 🔹 Загрузка актуальных токенов из сабграфа The Graph */
  private async fetchTokensFromGraph() {
    const query = `
      {
        tokens(first: 1000) {
          id
          symbol
          decimals
          name
          status
        }
      }
    `;

    try {
      const res = await fetch(this.graphUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const tokens = data?.data?.tokens || [];

      // Обновляем локальный кэш
      tokens.forEach((t: any) => {
        this.tokens.set(t.id.toLowerCase(), {
          address: t.id,
          symbol: t.symbol,
          decimals: t.decimals,
          name: t.name,
          status: t.status,
        });
      });

      console.log(`🔹 Loaded ${tokens.length} tokens from The Graph`);
    } catch (err) {
      console.error("⚠️ Error fetching tokens from The Graph:", err);
    }
  }

  /** 🔹 Запуск периодического обновления */
  private startPolling() {
    if (this.pollingInterval) clearInterval(this.pollingInterval);

    this.pollingInterval = setInterval(() => {
      this.fetchTokensFromGraph();
    }, this.POLL_INTERVAL);

    console.log("🔁 Started polling The Graph for tokens");
  }

  /** 🔹 Возврат нативного токена */
  getNativeToken(): TokenInfo {
    const native = this.tokens.get(zeroAddress);
    return native || this.nativeToken;
  }

  /** 🔹 Получить токен по адресу */
  getTokenInfo(address: string): TokenInfo | undefined {
    return this.tokens.get(address.toLowerCase());
  }

  /** 🔹 Активные токены */
  getActiveTokens(): TokenInfo[] {
    return Array.from(this.tokens.values()).filter((t) => t.status);
  }

  /** 🔹 Все токены (включая неактивные) */
  getAllTokens(): TokenInfo[] {
    return Array.from(this.tokens.values());
  }

  /** 🔹 Остановить автообновление */
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log("⏹️ TokenService polling stopped");
    }
  }

  /** 🔹 Принудительное обновление данных */
  forceRefresh() {
    this.fetchTokensFromGraph();
  }
}

export const tokenService = TokenService.getInstance();
