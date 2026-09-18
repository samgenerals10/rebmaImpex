// rebma-mobile/components/ui/DataList.tsx
// Ports: rebma-web/src/components/mobile/ResponsiveDataView.tsx — MOBILE
// CARD branch only (the desktop <table> branch has no native equivalent
// and none is needed). This is the single most-reused primitive across the
// ~90 web screens this app will eventually port, so getting this row right
// is most of the visual-parity work for every future department sub-phase.
import type { ComponentType, ReactNode } from 'react';
import { View, Text, Pressable } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { SkeletonList } from './Skeleton';
import EmptyState from './EmptyState';

export interface RowIcon {
  Icon: ComponentType<any>;
  color: string;
}

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
  /** Optional colored icon tile shown at the row's leading edge (mobile-ui-fluidity: every typed-entity row gets one). Omit for rows with no natural per-item icon. */
  rowIcon?: (row: T) => RowIcon;
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
  columns, data, rowKey, onRowPress, renderCard, renderActions, rowIcon,
  loading, skeletonRows = 5, emptyTitle = 'Nothing here yet', emptyDescription, emptyIcon,
}: Props<T>) {
  const t = useTheme();

  if (loading) return <SkeletonList rows={skeletonRows} />;
  if (data.length === 0) return <EmptyState title={emptyTitle} description={emptyDescription} icon={emptyIcon} />;

  const primaryCol = columns.find(c => c.primary);
  const statusCol = columns.find(c => c.status);
  const gridCols = columns.filter(c => !c.primary && !c.status && !c.mobileHidden);

  // Rendered as a plain View + map, not a FlatList: this component is always
  // embedded inside Screen's own vertical ScrollView, so scrollEnabled was
  // already false here and virtualization was never doing anything — using
  // FlatList only tripped RN's nested-VirtualizedList warning for free.
  return (
    <View>
      {data.map((item, index) => {
        const key = rowKey(item);
        const row = (() => {
          if (renderCard) return <>{renderCard(item)}</>;

          const RowWrapper = onRowPress ? Pressable : View;
          const icon = rowIcon?.(item);
          return (
            <RowWrapper
              onPress={onRowPress ? () => onRowPress(item) : undefined}
              style={({ pressed }: any) => [
                {
                  backgroundColor: pressed ? (t.darkMode ? '#2D3748' : '#F8F7FF') : t.colors.bgCard,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: t.colors.border,
                  padding: t.spacing.lg,
                },
                !pressed && t.shadow('card'),
              ]}
            >
              {(primaryCol || statusCol || icon) && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, marginBottom: gridCols.length ? t.spacing.md : 0 }}>
                  {icon ? (
                    <View style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: `${icon.color}18` }}>
                      <icon.Icon size={20} color={icon.color} />
                    </View>
                  ) : null}
                  {primaryCol ? (
                    <Text style={{ flex: 1, fontFamily: t.font.bold, fontSize: t.type.base16.size, color: t.colors.textPrimary }} numberOfLines={1}>
                      {cellValue(primaryCol, item)}
                    </Text>
                  ) : <View style={{ flex: 1 }} />}
                  {statusCol ? <View>{cellValue(statusCol, item)}</View> : null}
                  {onRowPress && !renderActions ? <ChevronRight size={16} color={t.colors.textMuted} /> : null}
                </View>
              )}

              {gridCols.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm, paddingTop: (primaryCol || statusCol || icon) ? t.spacing.xs : 0 }}>
                  {gridCols.map(col => (
                    <View key={col.key} style={{ width: '47%', paddingVertical: 2 }}>
                      <Text style={{ fontFamily: t.font.bold, fontSize: t.type.label9.size, letterSpacing: 0.5, textTransform: 'uppercase', color: t.colors.textMuted }}>
                        {col.label}
                      </Text>
                      <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body12.size, color: t.colors.textSecondary, marginTop: 3 }} numberOfLines={1}>
                        {cellValue(col, item)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {renderActions ? (
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: t.spacing.sm, marginTop: t.spacing.md, paddingTop: t.spacing.sm, borderTopWidth: 1, borderTopColor: t.colors.border }}>
                  {renderActions(item)}
                </View>
              ) : null}
            </RowWrapper>
          );
        })();

        return (
          <View key={key}>
            {index > 0 ? <View style={{ height: t.spacing.sm }} /> : null}
            {row}
          </View>
        );
      })}
    </View>
  );
}
