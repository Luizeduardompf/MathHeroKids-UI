import { useTranslation } from 'react-i18next';
import { PlaceholderScreen } from '@/components/layout/PlaceholderScreen';

export default function TrophyDetailScreen() {
  const { t } = useTranslation();
  return <PlaceholderScreen emoji="🏅" title={t('trophies.detailTitle')} />;
}
