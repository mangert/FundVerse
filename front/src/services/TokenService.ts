import { zeroAddress, type PublicClient, parseAbiItem, type Log } from 'viem';
import { PlatformABI } from '../utils/abi';
import { PLATFORM_ADDRESS } from '../utils/addresses';
import { BASE_TOKENS } from '../config/tokens';
import type { TokenConfig, NetworkTokensConfig } from '../config/tokens';

export interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
  status: boolean;
  addedAtBlock?: number;
  removedAtBlock?: number;
}

interface FVNewTokenAddedEvent extends Log {
  args: {
    token: string;
  };
}

interface FVTokenRemovedEvent extends Log {
  args: {
    token: string;
  };
}

class TokenService {
  private static instance: TokenService;
  private tokens: Map<string, TokenInfo> = new Map();
  private publicClient: PublicClient | null = null;
  private currentChainId: number | null = null;
  private lastProcessedBlock: bigint = 0n;
  private pollingInterval: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL = 30000; // 30 секунд
  private readonly MAX_BLOCK_RANGE = 100n; // Максимальный диапазон блоков за один опрос
  private readonly PROVIDER_MAX_BLOCK_RANGE = 10n; // Ограничение Alchemy - 10 блоков за запрос
  private readonly REQUEST_DELAY = 300; // Задержка между запросами в мс

  static getInstance(): TokenService {
    if (!TokenService.instance) {
      TokenService.instance = new TokenService();
    }
    return TokenService.instance;
  }

  async init(publicClient: PublicClient) {
    this.publicClient = publicClient;
    this.currentChainId = publicClient.chain?.id || null;
    
    if (!this.currentChainId) {
      console.warn('No chain ID available');
      return;
    }

    console.log('Initializing TokenService for Alchemy (10 block limit)...');
    
    // Загружаем базовые токены из конфига
    this.loadFromConfig();
    
    try {
      // Получаем текущий блок
      const currentBlock = await publicClient.getBlockNumber();
      this.lastProcessedBlock = currentBlock;
      console.log('Current block:', currentBlock.toString());
      
      // Загружаем актуальные события из блокчейна
      await this.loadEventsFromBlockchain();
      
      // Запускаем polling вместо подписки на события
      this.startPolling();
      
      console.log('TokenService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize TokenService:', error);
    }
  }

  private startPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    this.pollingInterval = setInterval(() => {
      this.pollNewEvents();
    }, this.POLL_INTERVAL);
    
    console.log('Started polling for token events');
  }

  private async pollNewEvents() {
    if (!this.publicClient) {
      console.warn('Public client not available for polling');
      return;
    }

    try {
      const currentBlock = await this.publicClient.getBlockNumber();
      
      if (currentBlock <= this.lastProcessedBlock) {
        console.log('No new blocks since last poll');
        return;
      }

      // Ограничиваем диапазон блоков
      let toBlock = currentBlock;
      if (currentBlock - this.lastProcessedBlock > this.MAX_BLOCK_RANGE) {
        toBlock = this.lastProcessedBlock + this.MAX_BLOCK_RANGE;
        console.log(`Limiting block range to ${this.MAX_BLOCK_RANGE} blocks`);
      }

      console.log(`Polling token events from block ${this.lastProcessedBlock + 1n} to ${toBlock}`);

      // Пагинация для провайдеров с ограничением
      let fromBlock = this.lastProcessedBlock + 1n;
      let allAddEvents: FVNewTokenAddedEvent[] = [];
      let allRemoveEvents: FVTokenRemovedEvent[] = [];

      while (fromBlock <= toBlock) {
        const chunkToBlock = fromBlock + this.PROVIDER_MAX_BLOCK_RANGE - 1n > toBlock 
          ? toBlock 
          : fromBlock + this.PROVIDER_MAX_BLOCK_RANGE - 1n;

        // Убедимся, что диапазон не превышает 10 блоков
        const blockRange = chunkToBlock - fromBlock + 1n;
        if (blockRange > 10n) {
          console.error('Block range exceeds 10 blocks, adjusting...');
          break;
        }

        console.log(`Fetching chunk: ${fromBlock} to ${chunkToBlock} (${blockRange} blocks)`);

        try {
          // Ищем события добавления токенов
          const addEvents = await this.publicClient.getLogs({
            address: PLATFORM_ADDRESS,
            event: parseAbiItem('event FVNewTokenAdded(address token)'),
            fromBlock: fromBlock,
            toBlock: chunkToBlock
          }) as FVNewTokenAddedEvent[];

          // Ищем события удаления токенов
          const removeEvents = await this.publicClient.getLogs({
            address: PLATFORM_ADDRESS,
            event: parseAbiItem('event FVTokenRemoved(address token)'),
            fromBlock: fromBlock,
            toBlock: chunkToBlock
          }) as FVTokenRemovedEvent[];

          allAddEvents = allAddEvents.concat(addEvents);
          allRemoveEvents = allRemoveEvents.concat(removeEvents);

          console.log(`Found ${addEvents.length} add events and ${removeEvents.length} remove events in chunk`);

          // Добавляем задержку между запросами
          await new Promise(resolve => setTimeout(resolve, this.REQUEST_DELAY));

        } catch (error) {
          console.error(`Error fetching blocks ${fromBlock}-${chunkToBlock}:`, error);
          
          // Обработка ошибки rate limiting
          if (error instanceof Error && (error.message.includes('rate limit') || error.message.includes('429') || error.message.includes('10 block range'))) {
            console.log('Rate limit or block range exceeded, waiting before next request...');
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }

        fromBlock = chunkToBlock + 1n;
      }

      // Обрабатываем события добавления
      for (const event of allAddEvents) {
        const tokenAddress = event.args.token;
        if (tokenAddress && !this.tokens.has(tokenAddress)) {
          await this.handleTokenAdded(tokenAddress, Number(event.blockNumber));
          console.log(`New token added: ${tokenAddress}`);
        }
      }

      // Обрабатываем события удаления
      for (const event of allRemoveEvents) {
        const tokenAddress = event.args.token;
        if (tokenAddress && this.tokens.has(tokenAddress)) {
          this.handleTokenRemoved(tokenAddress, Number(event.blockNumber));
          console.log(`Token removed: ${tokenAddress}`);
        }
      }

      // Обновляем последний обработанный блок
      this.lastProcessedBlock = toBlock;
      console.log(`Finished processing events up to block ${toBlock}`);

    } catch (error) {
      console.error('Error polling token events:', error);
      
      // В случае ошибки пытаемся пропустить проблемный диапазон блоков
      try {
        if (this.publicClient) {
          const currentBlock = await this.publicClient.getBlockNumber();
          this.lastProcessedBlock = currentBlock;
          console.log('Skipping problematic block range, moving to current block:', currentBlock.toString());
        }
      } catch (e) {
        console.error('Failed to recover from error:', e);
      }
    }
  }

  private loadFromConfig() {
    const chainId = this.currentChainId;
    if (!chainId || !(chainId in BASE_TOKENS)) {
      console.warn(`No config found for chainId: ${chainId}`);
      return;
    }

    const config = BASE_TOKENS[chainId] as NetworkTokensConfig;
    
    // Добавляем нативную валюту
    this.tokens.set(zeroAddress, {
      address: zeroAddress,
      symbol: config.native.symbol,
      decimals: config.native.decimals,
      name: config.native.name,
      status: true
    });

    console.log(`Added native token: ${config.native.symbol}`);

    // Добавляем токены из конфига
    config.tokens.forEach(token => {
      this.tokens.set(token.address, { ...token });
      console.log(`Added token from config: ${token.symbol} (${token.address})`);
    });
  }

  private async loadEventsFromBlockchain() {
    if (!this.publicClient || !this.currentChainId) {
      console.warn('Public client or chain ID not available');
      return;
    }

    const config = BASE_TOKENS[this.currentChainId] as NetworkTokensConfig;
    if (!config) {
      console.warn(`No config found for chainId: ${this.currentChainId}`);
      return;
    }

    const fromBlock = BigInt(config.contractDeploymentBlock);
    const toBlock = await this.publicClient.getBlockNumber();

    console.log(`Loading historical events from block ${fromBlock} to ${toBlock}`);
    console.log(`Contract address: ${PLATFORM_ADDRESS}`);

    // Пагинация для исторических событий
    let currentFromBlock = fromBlock;
    let allAddEvents: FVNewTokenAddedEvent[] = [];
    let allRemoveEvents: FVTokenRemovedEvent[] = [];

    while (currentFromBlock <= toBlock) {
      const chunkToBlock = currentFromBlock + this.PROVIDER_MAX_BLOCK_RANGE - 1n > toBlock 
        ? toBlock 
        : currentFromBlock + this.PROVIDER_MAX_BLOCK_RANGE - 1n;

      // Убедимся, что диапазон не превышает 10 блоков
      const blockRange = chunkToBlock - currentFromBlock + 1n;
      if (blockRange > 10n) {
        console.error('Block range exceeds 10 blocks, adjusting...');
        break;
      }

      console.log(`Fetching historical chunk: ${currentFromBlock} to ${chunkToBlock} (${blockRange} blocks)`);

      try {
        // Загружаем события добавления токенов     
        const addEvents = await this.publicClient.getLogs({
          address: PLATFORM_ADDRESS,
          event: parseAbiItem('event FVNewTokenAdded(address token)'),
          fromBlock: currentFromBlock,
          toBlock: chunkToBlock
        }) as FVNewTokenAddedEvent[];

        // Загружаем события удаления токенов
        const removeEvents = await this.publicClient.getLogs({
          address: PLATFORM_ADDRESS,
          event: parseAbiItem('event FVTokenRemoved(address token)'),
          fromBlock: currentFromBlock,
          toBlock: chunkToBlock
        }) as FVTokenRemovedEvent[];

        allAddEvents = allAddEvents.concat(addEvents);
        allRemoveEvents = allRemoveEvents.concat(removeEvents);

        console.log(`Found ${addEvents.length} add events and ${removeEvents.length} remove events in historical chunk`);

        // Добавляем задержку между запросами
        await new Promise(resolve => setTimeout(resolve, this.REQUEST_DELAY));

      } catch (error) {
        console.error(`Error fetching historical blocks ${currentFromBlock}-${chunkToBlock}:`, error);
        
        // Обработка ошибки rate limiting
        if (error instanceof Error && (error.message.includes('rate limit') || error.message.includes('429') || error.message.includes('10 block range'))) {
          console.log('Rate limit or block range exceeded, waiting before next request...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      currentFromBlock = chunkToBlock + 1n;
    }

    console.log(`Total historical events: ${allAddEvents.length} add events, ${allRemoveEvents.length} remove events`);

    // Обрабатываем события добавления
    for (const event of allAddEvents) {
      const tokenAddress = event.args.token;
      console.log(`Processing historical add event for token: ${tokenAddress}`);
      if (tokenAddress && !this.tokens.has(tokenAddress)) {
        await this.handleTokenAdded(tokenAddress, Number(event.blockNumber));
      }
    }

    // Обрабатываем события удаления
    for (const event of allRemoveEvents) {
      const tokenAddress = event.args.token;
      console.log(`Processing historical remove event for token: ${tokenAddress}`);
      if (tokenAddress && this.tokens.has(tokenAddress)) {
        this.handleTokenRemoved(tokenAddress, Number(event.blockNumber));
      }
    }
  }

  private async handleTokenAdded(tokenAddress: string, blockNumber?: number) {
    if (!this.publicClient) return;

    try {
      const tokenInfo = await this.fetchTokenInfo(tokenAddress);
      this.tokens.set(tokenAddress, {
        ...tokenInfo,
        status: true,
        addedAtBlock: blockNumber
      });
      console.log(`Token added successfully: ${tokenAddress} (${tokenInfo.symbol})`);
    } catch (error) {
      console.warn(`Failed to fetch info for token ${tokenAddress}:`, error);
    }
  }

  private handleTokenRemoved(tokenAddress: string, blockNumber?: number) {
    const token = this.tokens.get(tokenAddress);
    if (token) {
      token.status = false;
      token.removedAtBlock = blockNumber;
      console.log(`Token removed: ${tokenAddress}`);
    }
  }

  private async fetchTokenInfo(address: string): Promise<TokenInfo> {
    if (!this.publicClient) {
      throw new Error('Public client not initialized');
    }

    try {
      const [symbol, decimals, name] = await Promise.all([
        this.publicClient.readContract({
          address: address as `0x${string}`,
          abi: [{
            inputs: [],
            name: 'symbol',
            outputs: [{ name: '', type: 'string' }],
            stateMutability: 'view',
            type: 'function'
          }],
          functionName: 'symbol',
          args: []
        }) as Promise<string>,
        
        this.publicClient.readContract({
          address: address as `0x${string}`,
          abi: [{
            inputs: [],
            name: 'decimals',
            outputs: [{ name: '', type: 'uint8' }],
            stateMutability: 'view',
            type: 'function'
          }],
          functionName: 'decimals',
          args: []
        }) as Promise<number>,
        
        this.publicClient.readContract({
          address: address as `0x${string}`,
          abi: [{
            inputs: [],
            name: 'name',
            outputs: [{ name: '', type: 'string' }],
            stateMutability: 'view',
            type: 'function'
          }],
          functionName: 'name',
          args: []
        }) as Promise<string>
      ]);

      return {
        address,
        symbol,
        decimals,
        name,
        status: true
      };
    } catch (error) {
      console.error('Failed to fetch token info:', error);
      
      // Возвращаем базовую информацию в случае ошибки
      return {
        address,
        symbol: 'UNKNOWN',
        decimals: 18,
        name: 'Unknown Token',
        status: true
      };
    }
  }

  // Публичные методы для компонентов
  getTokenInfo(address: string): TokenInfo | undefined {
    return this.tokens.get(address);
  }

  getActiveTokens(): TokenInfo[] {
    return Array.from(this.tokens.values()).filter(token => token.status);
  }

  getAllTokens(): TokenInfo[] {
    return Array.from(this.tokens.values());
  }

  getNativeToken(): TokenInfo {
    return this.tokens.get(zeroAddress)!;
  }

  // Метод для остановки polling
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log('Token service polling stopped');
    }
  }

  // Метод для принудительной проверки событий
  forcePoll() {
    this.pollNewEvents();
  }
}

export const tokenService = TokenService.getInstance();