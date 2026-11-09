import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { confirmAction } from '@/components/confirm-action';
import { Button, Card, ErrorText, Icon, LoadingView, Muted, useLoad, usePalette } from '@/components/kit';
import { fetchInstituteLogo, removeInstituteLogo, saveInstituteLogo } from '@/services/institute-logo';
import { LogoPickError, pickLogo } from '@/services/logo-picker';
import { MAX_LOGO_KB } from '@/shared/logo-limits';

/**
 * The institute's logo, which its teachers can print in the header of their
 * exam papers. Only the tuition's own account sets or removes it.
 */
export function InstituteLogoCard() {
  const palette = usePalette();
  const logo = useLoad(fetchInstituteLogo, []);
  const [busy, setBusy] = useState<'save' | 'remove' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const choose = async () => {
    setError(null);
    try {
      const picked = await pickLogo();
      if (!picked) return;
      setBusy('save');
      const saved = await saveInstituteLogo(picked);
      logo.setData(() => saved);
    } catch (e) {
      setError(e instanceof LogoPickError || e instanceof Error ? e.message : "Couldn't save the logo. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const remove = () =>
    confirmAction('Remove the logo?', 'Exam PDFs your teachers make will no longer carry it.', 'Remove', async () => {
      setError(null);
      setBusy('remove');
      try {
        await removeInstituteLogo();
        logo.setData(() => null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't remove the logo. Try again.");
      } finally {
        setBusy(null);
      }
    });

  return (
    <Card>
      {logo.loading ? (
        <LoadingView label="Checking for your logo…" />
      ) : (
        <View style={styles.row}>
          <View style={[styles.preview, { borderColor: palette.border, backgroundColor: logo.data ? '#fff' : palette.secondary }]}>
            {logo.data ? (
              <Image accessibilityLabel="Your institute's logo" source={{ uri: logo.data.dataUri }} resizeMode="contain" style={styles.image} />
            ) : (
              <Icon name={{ ios: 'photo', android: 'image' }} color={palette.mutedForeground} size={26} />
            )}
          </View>
          <View style={styles.copy}>
            <Text style={[styles.title, { color: palette.foreground }]}>{logo.data ? 'Logo added' : 'No logo yet'}</Text>
            <Muted>Printed beside the institute&apos;s name in the header of exam PDFs your teachers make, when they choose it. A PNG or JPEG under {MAX_LOGO_KB} KB.</Muted>
          </View>
        </View>
      )}
      {logo.error && !logo.data ? <ErrorText message={`Couldn't check for a logo. ${logo.error}`} /> : null}
      <ErrorText message={error} />
      <Button
        label={logo.data ? 'Choose another logo' : 'Choose a logo'}
        variant="secondary"
        icon={{ ios: 'photo', android: 'image' }}
        loading={busy === 'save'}
        disabled={busy !== null || logo.loading}
        onPress={() => void choose()}
      />
      {logo.data ? (
        <Button label="Remove logo" variant="danger" icon={{ ios: 'trash', android: 'delete' }} loading={busy === 'remove'} disabled={busy !== null} onPress={remove} />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  preview: { width: 84, height: 84, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  copy: { flex: 1, gap: 4 },
  title: { fontSize: 15, fontWeight: '700' },
});
