import { useTranslation } from 'react-i18next';
import { PlaceholderScreen } from '@/components/layout/PlaceholderScreen';
import { Icons } from '@/constants/icons';

export default function NovaCriancaScreen() {
  const { t } = useTranslation();
  return <PlaceholderScreen emoji={Icons.newChild} title={t('parentArea.child.newTitle')} />;
}
