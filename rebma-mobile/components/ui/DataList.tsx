// rebma-mobile/components/ui/DataList.tsx
// Ports: rebma-web/src/components/mobile/ResponsiveDataView.tsx — MOBILE
// CARD branch only (the desktop <table> branch has no native equivalent
// and none is needed). This is the single most-reused primitive across the
// ~90 web screens this app will eventually port, so getting this row right
// is most of the visual-parity work for every future department sub-phase.
import type { ReactNode } from 'react';
import { View, Text, Pressable, FlatList } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { SkeletonList } from './Skeleton';
import EmptyState from './EmptyState';

export interface DataColumn<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  /** Used as the card's title. Exactly one column should set this. */
  primary?: boolean;
  /** Status-like columns render as a pill in the header row instead of a label:value row. */
  status?: boolean;
  /** Omit from the card entirely. */
  mobileHidden?: boolean;
  align?: 'left' | 'right' | 'center';
}

interface Props<T> {
  columns: DataColumn<T>[];
  data: T[];
  rowKey: (row: T) => string;
  onRowPress?: (row: T) => void;
  renderCard?: (row: T) => ReactNode;
  renderActions?: (row: T) => ReactNode;
  loading?: boolean;
  skeletonRows?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: ReactNode;
}

function cellValue<T>(col: DataColumn<T>, row: T): ReactNode {
  if (col.render) return col.render(row);
  const v = (row as any)[col.key];
  return v == null ? '—' : String(v);
}

export default function DataList<T>({
  columns, data, rowKey, onRowPress, renderCard, renderActions,
  loading, skeletonRows = 5, emptyTitle = 'Nothing here yet', emptyDescription, emptyIcon,
}: Props<T>) {
  const t = useTheme();

  if (loading) return <SkeletonList rows={skeletonRows} />;
  if (data.length === 0) return <EmptyState title={emptyTitle} description={emptyDescription} icon={emptyIcon} />;

  const primaryCol = columns.find(c => c.primary);
  const statusCol = columns.find(c => c.status);
  const gridCols = columns.filter(c => !c.primary && !c.status && !c.mobileHidden);

  return (
    <FlatList
      data={data}
      keyExtractor={rowKey}
      scrollEnabled={false}
      ItemSeparatorComponent={() => <View style={{ height: t.spacing.sm }} />}
      renderItem={({ item }) => {
        if (renderCard) return <>{renderCard(item)}</>;

        const RowWrapper = onRowPress ? Pressable : View;
        return (
          <RowWrapper
            onPress={onRowPress ? () => onRowPress(item) : undefined}
            style={({ pressed }: any) => [
              {
                backgroundColor: pressed ? t.colors.accentSoft : t.colors.bgCard,
                borderWidth: 1,
                borderColor: t.colors.border,
                borderRadius: t.radius.md,
                padding: t.spacing.md,
              },
            ]}
          >
            {(primaryCol || statusCol) && (
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: t.spacing.sm, marginBottom: gridCols.length ? t.spacing.sm : 0 }}>
                {primaryCol ? (
                  <Text style={{ flex: 1, fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary }} numberOfLines={1}>
                    {cellValue(primaryCol, item)}
                  </Text>
                ) : <View style={{ flex: 1 }} />}
                {statusCol ? <View>{cellValue(statusCol, item)}</View> : null}
              </View>
            )}

            {gridCols.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
                {gridCols.map(col => (
                  <View key={col.key} style={{ width: '47%' }}>
                    <Text style={{ fontFamily: t.font.bold, fontSize: t.type.label9.size, letterSpacing: t.type.label9.letterSpacing, textTransform: 'uppercase', color: t.colors.textMuted }}>
                      {col.label}
                    </Text>
                    <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
                      {cellValue(col, item)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {renderActions ? (
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: t.spacing.sm, marginTop: t.spacing.sm, paddingTop: t.spacing.sm, borderTopWidth: 1, borderTopColor: t.colors.border }}>
                {renderActions(item)}
              </View>
            ) : null}
          </RowWrapper>
        );
      }}
    />
  );
}
