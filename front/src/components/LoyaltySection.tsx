import { useState, useEffect } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { PlatformABI, LoyaltyABI } from '../utils/abi';
import { PLATFORM_ADDRESS, LOYALTY_NFT_ADDRESS } from '../utils/addresses';
import { errorService } from '../services/ErrorService';
import { useNotifications } from '../contexts/NotificationContext';

export const LoyaltySection = () => {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { addNotification } = useNotifications();
  
  const [hasNFT, setHasNFT] = useState(false);
  const [nftImage, setNftImage] = useState<string | null>(null);
  const [discount, setDiscount] = useState<number>(0);
  const [platformFee, setPlatformFee] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isMinting, setIsMinting] = useState(false);
  const [canMint, setCanMint] = useState(false);  

  useEffect(() => {
    const fetchLoyaltyData = async () => {
      if (!address || !publicClient || !LOYALTY_NFT_ADDRESS) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        
        // Проверяем, есть ли у пользователя NFT
        const balance = await publicClient.readContract({
          address: LOYALTY_NFT_ADDRESS,
          abi: LoyaltyABI,
          functionName: 'balanceOf',
          args: [address],
        }) as bigint;

        const hasNFT = Number(balance) > 0;
        setHasNFT(hasNFT);

        if (hasNFT) {
          // Получаем изображение NFT
          try {
            const tokenURI = await publicClient.readContract({
              address: LOYALTY_NFT_ADDRESS,
              abi: LoyaltyABI,
              functionName: 'tokenURI',
              args: [1], // нумерация начинается с 1
            }) as string;

            // Загружаем метаданные NFT
            const resolvedURI = tokenURI.startsWith('ipfs://') 
              ? `https://ipfs.io/ipfs/${tokenURI.split('ipfs://')[1]}`
              : tokenURI;

            const metadataResponse = await fetch(resolvedURI);
            const metadata = await metadataResponse.json();
            
            // Обрабатываем изображение IPFS
            if (metadata.image) {
              const imageURI = metadata.image.startsWith('ipfs://')
                ? `https://ipfs.io/ipfs/${metadata.image.split('ipfs://')[1]}`
                : metadata.image;
              setNftImage(imageURI);
            }
          } catch (error) {
            console.error('Failed to fetch NFT metadata:', error);
          }

          // Получаем скидку из NFT
          const nftDiscount = await publicClient.readContract({
            address: LOYALTY_NFT_ADDRESS,
            abi: LoyaltyABI,
            functionName: 'getFounderDiscount',
            args: [address],
          }) as number;

          setDiscount(nftDiscount);
        }

        // Получаем комиссию платформы
        const fee = await publicClient.readContract({
          address: PLATFORM_ADDRESS,
          abi: PlatformABI,
          functionName: 'getFounderFee',
          args: [address],
        }) as number;

        setPlatformFee(fee);

        // Проверяем, может ли пользователь mint NFT
        const canMintResult = await publicClient.readContract({
          address: LOYALTY_NFT_ADDRESS,
          abi: LoyaltyABI,
          functionName: 'validateMintEligibility',
          args: [address],
        }) as boolean;

        setCanMint(canMintResult && !hasNFT);

      } catch (error) {
        console.error('Error fetching loyalty data:', error);
        addNotification({
          type: 'error',
          message: 'Failed to load loyalty data',
          isGlobal: false,
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchLoyaltyData();
  }, [address, publicClient, addNotification]);

  const handleMintNFT = async () => {
    if (!address || !walletClient || !LOYALTY_NFT_ADDRESS) {
      addNotification({
        type: 'error',
        message: 'Please connect your wallet to mint NFT',
        isGlobal: false,
      });
      return;
    }

    setIsMinting(true);
    
    try {
      const hash = await walletClient.writeContract({
        address: LOYALTY_NFT_ADDRESS,
        abi: LoyaltyABI,
        functionName: 'safeMint',
        args: [address],
      });

      addNotification({
        type: 'info',
        message: 'Minting NFT...',
        isGlobal: false,
        transactionHash: hash,
      });

      const receipt = await publicClient?.waitForTransactionReceipt({ hash });
      
      if (receipt?.status === 'success') {
        addNotification({
          type: 'success',
          message: 'NFT minted successfully!',
          isGlobal: false,
        });
        
        // Обновляем данные
        setHasNFT(true);
        setCanMint(false);
        
        // Получаем обновленную скидку
        const nftDiscount = await publicClient?.readContract({
          address: LOYALTY_NFT_ADDRESS,
          abi: LoyaltyABI,
          functionName: 'getFounderDiscount',
          args: [address],
        }) as number;

        setDiscount(nftDiscount);
      } else {
        addNotification({
          type: 'error',
          message: 'NFT mint failed',
          isGlobal: false,
        });
      }
    } catch (err) {
      const decodedError = errorService.decodeContractError(err);
      addNotification({
        type: decodedError.type as any,
        message: decodedError.message,
        isGlobal: false,
      });
    } finally {
      setIsMinting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="loyalty-section">
        <h2>Loyalty Program</h2>
        <div className="loading-message">
          <p>Loading loyalty data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="loyalty-section">
      <h2>Loyalty Program</h2>
      
      {hasNFT ? (
        <div className="nft-info">
          <h3>Your Loyalty NFT</h3>
          <div className="nft-content">
            {nftImage && (
              <div className="nft-image-container">
                <img src={nftImage} alt="Loyalty NFT" className="nft-image" />
              </div>
            )}
            <div className="discount-info">
              <div className="discount-item">
                <span className="discount-label">Your NFT discount:</span>
                <span className="discount-value">{discount}‰</span>
              </div>
              <div className="discount-item">
                <span className="discount-label">Platform fee for you:</span>
                <span className="discount-value">{platformFee}‰</span>
              </div>
              <div className="discount-item comparison">
                <span className="discount-label">Standard platform fee:</span>
                <span className="discount-value">{platformFee + discount}‰</span>
              </div>
              <div className="savings">
                You save {discount}‰ on each campaign!
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="no-nft">
          <h3>No Loyalty NFT</h3>
          <p>You don't have a loyalty NFT yet.</p>
          {canMint && (
            <div className="mint-section">
              <button 
                className="btn btn-primary"
                onClick={handleMintNFT}
                disabled={isMinting}
              >
                {isMinting ? 'Minting...' : 'Mint Loyalty NFT'}
              </button>
              <div className="mint-benefits">
                <h4>Benefits of having a Loyalty NFT:</h4>
                <ul>
                  <li>Reduced platform fees on all your campaigns</li>
                  <li>Special recognition as a loyal creator</li>
                  <li>Early access to new platform features</li>
                </ul>
              </div>
            </div>
          )}
          {!canMint && (
            <div className="mint-requirements">
              <h4>Requirements to mint a Loyalty NFT:</h4>
              <p>To mint a loyalty NFT, you need to successfully complete your first campaign.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};