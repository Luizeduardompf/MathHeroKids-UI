import { useTranslation } from 'react-i18next';
import { PlaceholderScreen } from '@/components/layout/PlaceholderScreen';
import { Icons } from '@/constants/icons';

export default function ControlesScreen() {
  const { t } = useTranslation();
  return <PlaceholderScreen emoji={Icons.settings} title={t('parentArea.controls.title')} />;
}
