import React from 'react';

import MarketplacePage, { type MarketplacePageProps } from '../../src/pages/marketplace/MarketplacePage';

export type ChallengeMarketplaceProps = MarketplacePageProps;

const ChallengeMarketplace: React.FC<ChallengeMarketplaceProps> = (props) => <MarketplacePage {...props} />;

export default ChallengeMarketplace;
