import React, { useState, useEffect } from 'react';
import { X, Calendar, Package, Info, CheckCircle, Factory, ClipboardList, DollarSign } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { operations } from '../services/apiClient';

interface StockIntakeFormProps {
  isOpen: boolean;
  onClose: () => void;
  addNotification: (msg: string) => void;
  onSuccess?: () => void;
}

export default function StockIntakeForm({
  isOpen,
  onClose,
  addNotification,
  onSuccess
}: StockIntakeFormProps) {
  const [classification, setClassification] = useState<'COMPANY_PRODUCT' | 'GENERAL_PURCHASE'>('COMPANY_PRODUCT');
  const [loading, setLoading] = useState(false);

  // In-house production / Company Product state
  const [ihProductName, setIhProductName] = useState('');
  const [ihGoodsCode, setIhGoodsCode] = useState('');
  const [ihUnits, setIhUnits] = useState('');
  const [ihWeight, setIhWeight] = useState('');
  const [ihGoodsType, setIhGoodsType] = useState('');
  const [ihDate, setIhDate] = useState('');
  const [ihProductionReqId, setIhProductionReqId] = useState('');
  const [productionOutputs, setProductionOutputs] = useState<any[]>([]);

  // General purchase state
  const [gpItemName, setGpItemName] = useState('');
  const [gpItemCode, setGpItemCode] = useState('');
  const [gpCategory, setGpCategory] = useState('');
  const [gpQuantity, setGpQuantity] = useState('');
  const [gpCost, setGpCost] = useState('');
  const [gpDate, setGpDate] = useState('');

  // Fetch production batches for dropdown
  useEffect(() => {
    if (isOpen && classification === 'COMPANY_PRODUCT') {
      supabase
        .from('production_requests')
        .select('id, items, status, produced_goods, created_at')
        .in('status', ['COMPLETED', 'TICKETS_ISSUED'])
        .order('created_at', { ascending: false })
        .then(
          ({ data }) => {
            if (data) setProductionOutputs(data);
          },
          () => {}
        );
    }
  }, [isOpen, classification]);

  if (!isOpen) return null;

  const autoGoodsCode = () => `GC-${Date.now().toString().slice(-6)}`;
  const autoGpCode = () => `GP-${Date.now().toString().slice(-6)}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (classification === 'COMPANY_PRODUCT') {
        const code = ihGoodsCode.trim() || autoGoodsCode();
        // Log cargo intake under REBMA IN-HOUSE PRODUCTION
        await operations.logIntake({
          productName: ihProductName,
          goodsCode: code,
          destination: 'Main Warehouse',
          country: 'Ghana',
          company: 'REBMA IN-HOUSE PRODUCTION',
          quantity: parseInt(ihUnits) || 0,
          weight: parseFloat(ihWeight) || 0,
          discrepancies: 'None',
          createdAt: ihDate ? new Date(ihDate).toISOString() : new Date().toISOString(),
          metadata: {
            goodsType: ihGoodsType,
            productionRequestId: ihProductionReqId || null
          }
        } as any);

        addNotification(`Company product stock intake logged: ${ihProductName} (${code})`);
        
        // Reset form
        setIhProductName('');
        setIhGoodsCode('');
        setIhUnits('');
        setIhWeight('');
        setIhGoodsType('');
        setIhDate('');
        setIhProductionReqId('');
      } else {
        const code = gpItemCode.trim() || autoGpCode();
        // Log general purchase
        await operations.logGeneralPurchase({
          itemName: gpItemName,
          itemCode: code,
          category: gpCategory,
          quantity: parseInt(gpQuantity) || 0,
          cost: parseFloat(gpCost) || 0,
          dateReceived: gpDate || new Date().toISOString().split('T')[0]
        });

        addNotification(`General purchase logged: ${gpItemName} (${code})`);

        // Reset form
        setGpItemName('');
        setGpItemCode('');
        setGpCategory('');
        setGpQuantity('');
        setGpCost('');
        setGpDate('');
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      alert(err.message || 'An error occurred during submission.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl border border-[var(--border)] w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col text-[var(--text-primary)]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)] sticky top-0 bg-[var(--bg-card)] z-10">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-[var(--accent)] animate-pulse" />
            <h3 className="text-base font-bold">Warehouse Stock Intake</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--accent-light)] hover:text-[var(--accent)] cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Classification Selector */}
        <div className="px-6 pt-5">
          <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">
            Classification / Intake Category
          </label>
          <div className="flex gap-2 bg-[var(--bg)] p-1 rounded-xl border border-[var(--border)]">
            <button
              type="button"
              onClick={() => setClassification('COMPANY_PRODUCT')}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                classification === 'COMPANY_PRODUCT'
                  ? 'bg-[var(--bg-card)] shadow text-[var(--accent)] border border-[var(--border)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-transparent border-0'
              }`}
            >
              <Factory className="w-4 h-4" />
              Company Produced Goods
            </button>
            <button
              type="button"
              onClick={() => setClassification('GENERAL_PURCHASE')}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                classification === 'GENERAL_PURCHASE'
                  ? 'bg-[var(--bg-card)] shadow text-[var(--accent)] border border-[var(--border)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-transparent border-0'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              General Purchased Items
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 flex-1">
          {classification === 'COMPANY_PRODUCT' ? (
            <>
              {/* LINK TO PRODUCTION REQUEST */}
              {productionOutputs.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                    Link to Completed Production Batch
                  </label>
                  <select
                    value={ihProductionReqId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setIhProductionReqId(id);
                      if (id) {
                        const req = productionOutputs.find((r) => r.id === id);
                        if (req && req.items?.length > 0) {
                          setIhProductName(req.items[0].materialName || '');
                          setIhUnits(String(req.items[0].quantity || ''));
                        }
                      }
                    }}
                    className="w-full px-3 py-2 bg-[var(--bg)] text-[var(--text-primary)] border border-[var(--border)] focus:border-[var(--accent)] rounded-xl text-xs focus:outline-none"
                  >
                    <option value="">— Select a completed production batch —</option>
                    {productionOutputs.map((req) => (
                      <option key={req.id} value={req.id}>
                        {req.id} · {req.items?.[0]?.materialName || 'Batch'} ({req.status})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* PRODUCT NAME & CODE */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                    Product Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={ihProductName}
                    onChange={(e) => setIhProductName(e.target.value)}
                    required
                    placeholder="E.g., Refined Palm Oil Barrels"
                    className="w-full px-3 py-2 bg-[var(--bg)] text-[var(--text-primary)] border border-[var(--border)] focus:border-[var(--accent)] rounded-xl text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                    Goods Code <span className="text-[var(--text-muted)] font-normal">(auto-generated if empty)</span>
                  </label>
                  <input
                    type="text"
                    value={ihGoodsCode}
                    onChange={(e) => setIhGoodsCode(e.target.value)}
                    placeholder={`E.g., ${autoGoodsCode()}`}
                    className="w-full px-3 py-2 bg-[var(--bg)] text-[var(--text-primary)] border border-[var(--border)] focus:border-[var(--accent)] rounded-xl text-xs focus:outline-none"
                  />
                </div>
              </div>

              {/* TYPE OF GOODS */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                  Type of Goods <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={ihGoodsType}
                  onChange={(e) => setIhGoodsType(e.target.value)}
                  required
                  placeholder="E.g., Finished Product, Packaged Goods, Bulk Output"
                  className="w-full px-3 py-2 bg-[var(--bg)] text-[var(--text-primary)] border border-[var(--border)] focus:border-[var(--accent)] rounded-xl text-xs focus:outline-none"
                />
              </div>

              {/* QUANTITY & WEIGHT */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                    Units / Boxes Produced <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={ihUnits}
                    onChange={(e) => setIhUnits(e.target.value)}
                    required
                    min="1"
                    placeholder="E.g., 240"
                    className="w-full px-3 py-2 bg-[var(--bg)] text-[var(--text-primary)] border border-[var(--border)] focus:border-[var(--accent)] rounded-xl text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                    Weight (Metric Tons) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={ihWeight}
                    onChange={(e) => setIhWeight(e.target.value)}
                    required
                    min="0.001"
                    placeholder="E.g., 5.0"
                    className="w-full px-3 py-2 bg-[var(--bg)] text-[var(--text-primary)] border border-[var(--border)] focus:border-[var(--accent)] rounded-xl text-xs focus:outline-none"
                  />
                </div>
              </div>

              {/* DATE RECEIVED */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                  Date Received into Warehouse <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={ihDate}
                  onChange={(e) => setIhDate(e.target.value)}
                  required
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 bg-[var(--bg)] text-[var(--text-primary)] border border-[var(--border)] focus:border-[var(--accent)] rounded-xl text-xs focus:outline-none"
                />
              </div>

              {/* NOTE INFO */}
              <div className="p-3.5 bg-[var(--accent-light)] border border-[var(--border)] rounded-xl text-xs text-[var(--accent)] flex items-start gap-2.5">
                <Info className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  This intake will be recorded under in-house production. Upon approval by Management, it will automatically populate finished product stock and add a transaction to the stock ledger.
                </span>
              </div>
            </>
          ) : (
            <>
              {/* ITEM NAME & CODE */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                    Item Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={gpItemName}
                    onChange={(e) => setGpItemName(e.target.value)}
                    required
                    placeholder="E.g., Office Printer Paper"
                    className="w-full px-3 py-2 bg-[var(--bg)] text-[var(--text-primary)] border border-[var(--border)] focus:border-[var(--accent)] rounded-xl text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                    Item Code / Reference <span className="text-[var(--text-muted)] font-normal">(auto-generated if empty)</span>
                  </label>
                  <input
                    type="text"
                    value={gpItemCode}
                    onChange={(e) => setGpItemCode(e.target.value)}
                    placeholder={`E.g., ${autoGpCode()}`}
                    className="w-full px-3 py-2 bg-[var(--bg)] text-[var(--text-primary)] border border-[var(--border)] focus:border-[var(--accent)] rounded-xl text-xs focus:outline-none"
                  />
                </div>
              </div>

              {/* CATEGORY / TYPE */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                  Category / Type <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={gpCategory}
                  onChange={(e) => setGpCategory(e.target.value)}
                  required
                  placeholder="E.g., Office Supplies, Hardware, Warehouse Consumables"
                  className="w-full px-3 py-2 bg-[var(--bg)] text-[var(--text-primary)] border border-[var(--border)] focus:border-[var(--accent)] rounded-xl text-xs focus:outline-none"
                />
              </div>

              {/* QUANTITY & COST */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                    Quantity <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={gpQuantity}
                    onChange={(e) => setGpQuantity(e.target.value)}
                    required
                    min="1"
                    placeholder="E.g., 10"
                    className="w-full px-3 py-2 bg-[var(--bg)] text-[var(--text-primary)] border border-[var(--border)] focus:border-[var(--accent)] rounded-xl text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                    Cost / Amount Spent (GHS) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={gpCost}
                    onChange={(e) => setGpCost(e.target.value)}
                    required
                    min="0"
                    placeholder="E.g., 250.00"
                    className="w-full px-3 py-2 bg-[var(--bg)] text-[var(--text-primary)] border border-[var(--border)] focus:border-[var(--accent)] rounded-xl text-xs focus:outline-none"
                  />
                </div>
              </div>

              {/* DATE RECEIVED */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                  Date Received <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={gpDate}
                  onChange={(e) => setGpDate(e.target.value)}
                  required
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 bg-[var(--bg)] text-[var(--text-primary)] border border-[var(--border)] focus:border-[var(--accent)] rounded-xl text-xs focus:outline-none"
                />
              </div>

              {/* NOTE INFO */}
              <div className="p-3.5 bg-[var(--accent-light)] border border-[var(--border)] rounded-xl text-xs text-[var(--accent)] flex items-start gap-2.5">
                <Info className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  This entry will be recorded under general purchases. Once approved by Management, it will be visible in the stock table under general purchases and sync with the Finance, CEO, and Management terminals.
                </span>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-2.5 bg-[var(--bg)] border border-[var(--border)] hover:bg-[var(--accent-light)] rounded-xl text-xs font-bold cursor-pointer transition-colors text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-[var(--accent)] hover:opacity-90 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow cursor-pointer transition-all text-center flex items-center justify-center gap-2"
            >
              {loading ? 'Submitting...' : 'Submit Stock Inflow'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
