import { useTranslation } from 'react-i18next';
import { PlaceholderScreen } from '@/components/layout/PlaceholderScreen';
import { Icons } from '@/constants/icons';

export default function RewardsScreen() {
  const { t } = useTranslation();
  return <PlaceholderScreen emoji={Icons.gift} title={t('progression.rewards.title')} />;
}
