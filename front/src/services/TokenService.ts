// 🔹 Сервис получения токенов теперь работает напрямую с The Graph
import { zeroAddress } from "viem";

// структура, совпадающая с твоей логикой
export interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
  status: boolean;
  addedAtBlock?: number;
  removedAtBlock?: number;
}

class TokenService {
  private static instance: TokenService;
  private tokens: Map<string, TokenInfo> = new Map();
  private pollingInterval: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL = 30_000; // опрос каждые 30 сек

  // ✅ Graph endpoint из .env  
  private readonly GRAPH_URL = import.meta.env.VITE_GRAPHQL_API_URL;

  static getInstance(): TokenService {
    if (!TokenService.instance) {
      TokenService.instance = new TokenService();
    }
    return TokenService.instance;
  }

  // инициализация — подгружаем токены и запускаем опрос
  async init() {
    console.log("Initializing TokenService via The Graph...");

    try {
      await this.fetchTokens();
      this.startPolling();
      console.log("TokenService initialized successfully (Graph)");
    } catch (error) {
      console.error("Failed to initialize TokenService:", error);
    }
  }

  // 🔹 Метод получения токенов через GraphQL-запрос
  private async fetchTokens() {
    const query = `
      {
        tokens(first: 1000) {
          id
          symbol
          decimals
          name
          status
          blockNumber
          blockTimestamp
        }
      }
    `;

    try {
      const res = await fetch(this.GRAPH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const { data } = await res.json();
      if (!data?.tokens) throw new Error("Invalid response from Graph");

      const tokens: TokenInfo[] = data.tokens.map((t: any) => ({
        address: t.id,
        symbol: t.symbol,
        decimals: Number(t.decimals),
        name: t.name,
        status: t.status,
        addedAtBlock: Number(t.blockNumber),
      }));

      this.tokens.clear();
      tokens.forEach((t) => this.tokens.set(t.address.toLowerCase(), t));

      //отладочный - удалить!!!
      console.log(`Loaded ${tokens.length} tokens from The Graph`);

      // 🔹 Проверка: выводим все токены сразу после загрузки
      console.log("Current tokens in TokenService:");
      this.tokens.forEach((token, addr) => {
      console.log(`${addr}: ${token.symbol} (${token.status ? "active" : "inactive"})`);
      });
      //конец отладки

      console.log(`Loaded ${tokens.length} tokens from The Graph`);
    } catch (err) {
      console.error("Error fetching tokens from The Graph:", err);
    }
  }

  // 🔁 Запускаем периодический опрос (аналогично бэку)
  private startPolling() {
    if (this.pollingInterval) clearInterval(this.pollingInterval);

    this.pollingInterval = setInterval(() => {
      this.fetchTokens();
    }, this.POLL_INTERVAL);

    console.log("Started polling The Graph for tokens");
  }

  // 🪙 Возвращаем нативный токен (ETH / native)
  getNativeToken(): TokenInfo {
    const native = this.tokens.get(zeroAddress);
    if (!native) {
      return {
        address: zeroAddress,
        symbol: "ETH",
        decimals: 18,
        name: "Ethereum",
        status: true,
      };
    }
    return native;
  }

  // 🔍 Получить токен по адресу
  getTokenInfo(address: string): TokenInfo | undefined {
    return this.tokens.get(address.toLowerCase());
  }

  // ✅ Только активные токены
  getActiveTokens(): TokenInfo[] {
    return Array.from(this.tokens.values()).filter((t) => t.status);
  }

  // 🧩 Все токены
  getAllTokens(): TokenInfo[] {
    return Array.from(this.tokens.values());
  }

  // 🛑 Остановить опрос
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log("TokenService polling stopped");
    }
  }

  // 🔄 Принудительно обновить данные
  forceRefresh() {
    this.fetchTokens();
  }
}

export const tokenService = TokenService.getInstance();