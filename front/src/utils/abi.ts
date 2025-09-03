import PlatformABI_JSON from '../contracts/abis/Platform.json';
import CampaignABI_JSON from '../contracts/abis/ICampaign.json';
import LoyaltyABI_JSON from '../contracts/abis/FundVerseLoyaltyv1.json';

export const getABI = (json: any) => {
  if (Array.isArray(json)) return json;
  if (json && Array.isArray(json.abi)) return json.abi;
  throw new Error('Invalid ABI format');
};

export const PlatformABI = getABI(PlatformABI_JSON);
export const CampaignABI = getABI(CampaignABI_JSON);
export const LoyaltyABI = getABI(LoyaltyABI_JSON);