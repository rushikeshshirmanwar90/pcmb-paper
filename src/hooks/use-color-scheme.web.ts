import { useAppearance } from '@/context/appearance-context';

export function useColorScheme() {
	return useAppearance().mode;
}
