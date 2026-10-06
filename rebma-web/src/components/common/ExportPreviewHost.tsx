// rebma-web/src/components/common/ExportPreviewHost.tsx
// Shows the branded export preview whenever any screen asks for an export
// (utils/exportPreview.ts). Mounted once, in App.tsx.
import { useEffect, useState } from 'react';
import UniversalExportModal from './UniversalExportModal';
import { subscribeExportPreview, closeExportPreview, type ExportRequest } from '../../utils/exportPreview';

export default function ExportPreviewHost() {
  const [request, setRequest] = useState<ExportRequest | null>(null);
  useEffect(() => subscribeExportPreview(setRequest), []);
  if (!request) return null;
  return (
    <UniversalExportModal
      open
      onClose={closeExportPreview}
      title={request.title}
      subtitle={request.subtitle}
      data={request.data}
      columns={request.columns}
    />
  );
}
