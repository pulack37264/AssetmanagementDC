import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import './App.css';
import type { Asset, Repair, DashboardStats, License, AuthUser } from './api';
import {
  clearToken,
  completeRepair,
  createAsset,
  createRepair,
  deleteAssetInvoice,
  getDashboardStats,
  getInvoiceUrl,
  getMe,
  getNeedSetup,
  getToken,
  listAssets,
  listRepairs,
  login,
  setupFirstAdmin,
  setToken,
  updateAsset,
  uploadAssetInvoice,
  listLicenses,
  createLicense,
  updateLicense,
  deleteLicense,
  emailInventoryReport,
} from './api';

type Tab = 'dashboard' | 'assets' | 'repairs' | 'licenses';

/** Returns remaining days until date (YYYY-MM-DD). Negative if past, 0 if today. */
function getRemainingDays(dateStr: string | null | undefined): number | null {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const expiry = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  const diffMs = expiry.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function App() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [needSetup, setNeedSetup] = useState<boolean | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setAuthChecking(false);
      setAuthUser(null);
      return;
    }
    getMe()
      .then((user) => {
        setAuthUser(user);
      })
      .catch(() => {
        setAuthUser(null);
      })
      .finally(() => {
        setAuthChecking(false);
      });
  }, []);

  useEffect(() => {
    const onLogout = () => setAuthUser(null);
    window.addEventListener('auth-logout', onLogout);
    return () => window.removeEventListener('auth-logout', onLogout);
  }, []);

  useEffect(() => {
    if (authChecking || authUser) return;
    getNeedSetup().then(setNeedSetup).catch(() => setNeedSetup(true));
  }, [authChecking, authUser]);

  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  // Assets state
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetLoading, setAssetLoading] = useState(true);
  const [assetError, setAssetError] = useState<string | null>(null);
  const [assetName, setAssetName] = useState('');
  const [assetType, setAssetType] = useState('');
  const [assetStatus, setAssetStatus] = useState('In Service');
  const [serialNumber, setSerialNumber] = useState('');
  const [vendor, setVendor] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [warrantyExpiry, setWarrantyExpiry] = useState('');
  const [assetRoom, setAssetRoom] = useState('');
  const [assetRack, setAssetRack] = useState('');
  const [assetRackUnit, setAssetRackUnit] = useState('');
  const [assetManagementIp, setAssetManagementIp] = useState('');
  const [assetInvoiceFile, setAssetInvoiceFile] = useState<File | null>(null);
  const [assetInvoiceNumber, setAssetInvoiceNumber] = useState('');
  const [removeAssetInvoice, setRemoveAssetInvoice] = useState(false);
  const [assetSubmitting, setAssetSubmitting] = useState(false);
  const [invoiceNumberByAsset, setInvoiceNumberByAsset] = useState<Record<number, string>>({});
  const [uploadingInvoiceId, setUploadingInvoiceId] = useState<number | null>(null);
  const [showAddAssetForm, setShowAddAssetForm] = useState(false);
  const [assetStep, setAssetStep] = useState<'form' | 'preview'>('form');
  const [editingAssetId, setEditingAssetId] = useState<number | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);
  const [assetSearchQuery, setAssetSearchQuery] = useState('');
  const [assetSortBy, setAssetSortBy] = useState<'Name' | 'Type' | 'SerialNumber' | 'Status' | 'Vendor'>('Name');
  const [assetSortDir, setAssetSortDir] = useState<'asc' | 'desc'>('asc');

  // Repairs state
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [repairLoading, setRepairLoading] = useState(true);
  const [repairError, setRepairError] = useState<string | null>(null);
  const [showLogRepairForm, setShowLogRepairForm] = useState(false);
  const [repairAssetId, setRepairAssetId] = useState<number | ''>('');
  const [repairAssetSearchQuery, setRepairAssetSearchQuery] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [repairVendor, setRepairVendor] = useState('');
  const [repairCost, setRepairCost] = useState('');
  const [repairSubmitting, setRepairSubmitting] = useState(false);
  const [completingId, setCompletingId] = useState<number | null>(null);
  const [repairSearchQuery, setRepairSearchQuery] = useState('');
  const [repairSearchApplied, setRepairSearchApplied] = useState('');

  // Dashboard state
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [dashSearchQuery, setDashSearchQuery] = useState('');
  const [inventoryEmailSending, setInventoryEmailSending] = useState(false);
  const [inventoryEmailMessage, setInventoryEmailMessage] = useState<string | null>(null);
  const [inventoryEmailError, setInventoryEmailError] = useState<string | null>(null);
  const [inventoryEmailTarget, setInventoryEmailTarget] = useState<'assets' | 'licenses' | null>(null);
  const [selectedAssetReportIds, setSelectedAssetReportIds] = useState<number[]>([]);
  const [selectedLicenseReportIds, setSelectedLicenseReportIds] = useState<number[]>([]);

  // Licenses state
  const [licenses, setLicenses] = useState<License[]>([]);
  const [licenseLoading, setLicenseLoading] = useState(true);
  const [licenseError, setLicenseError] = useState<string | null>(null);
  const [licenseName, setLicenseName] = useState('');
  const [licenseVendor, setLicenseVendor] = useState('');
  const [licensePurchaseDate, setLicensePurchaseDate] = useState('');
  const [licenseExpiryDate, setLicenseExpiryDate] = useState('');
  const [licenseCost, setLicenseCost] = useState('');
  const [licenseSubmitting, setLicenseSubmitting] = useState(false);
  const [editingLicenseId, setEditingLicenseId] = useState<number | null>(null);

  async function refreshAssets() {
    try {
      setAssetError(null);
      setAssetLoading(true);
      const data = await listAssets();
      setAssets(data);
    } catch (e: any) {
      setAssetError(e.message ?? 'Failed to load assets');
    } finally {
      setAssetLoading(false);
    }
  }

  async function refreshRepairs() {
    try {
      setRepairError(null);
      setRepairLoading(true);
      const data = await listRepairs();
      setRepairs(data);
    } catch (e: any) {
      setRepairError(e.message ?? 'Failed to load repairs');
    } finally {
      setRepairLoading(false);
    }
  }

  async function refreshDashboard() {
    try {
      setDashboardError(null);
      setDashboardLoading(true);
      const data = await getDashboardStats();
      setDashboardStats(data);
    } catch (e: any) {
      setDashboardError(e.message ?? 'Failed to load dashboard');
    } finally {
      setDashboardLoading(false);
    }
  }

  async function onEmailInventory(listType: 'assets' | 'licenses', ids: number[]) {
    setInventoryEmailSending(true);
    setInventoryEmailTarget(listType);
    setInventoryEmailMessage(null);
    setInventoryEmailError(null);
    try {
      const result = await emailInventoryReport(listType, ids);
      const listLabel = listType === 'assets' ? 'equipment' : 'software license';
      setInventoryEmailMessage(`Email sent to management: ${result.recordCount} ${listLabel} records.`);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown email error';
      setInventoryEmailError(`Email was not sent: ${errorMessage}`);
    } finally {
      setInventoryEmailSending(false);
    }
  }

  useEffect(() => {
    if (!authUser) return;
    void refreshAssets();
    void refreshRepairs();
    void refreshDashboard();
    void (async () => {
      try {
        setLicenseError(null);
        setLicenseLoading(true);
        const data = await listLicenses();
        setLicenses(data);
      } catch (e: any) {
        setLicenseError(e.message ?? 'Failed to load licenses');
      } finally {
        setLicenseLoading(false);
      }
    })();
  }, [authUser]);

  // Search infrastructure by identity, placement, network address, or status.
  const dashSearchLower = dashSearchQuery.trim().toLowerCase();
  const dashSearchResults = dashSearchLower
    ? assets.filter((a) => {
        return (
          a.Name.toLowerCase().includes(dashSearchLower) ||
          a.SerialNumber.toLowerCase().includes(dashSearchLower) ||
          a.Type.toLowerCase().includes(dashSearchLower) ||
          a.Vendor.toLowerCase().includes(dashSearchLower) ||
          a.Status.toLowerCase().includes(dashSearchLower) ||
          (a.Room ?? '').toLowerCase().includes(dashSearchLower) ||
          (a.Rack ?? '').toLowerCase().includes(dashSearchLower) ||
          (a.RackUnit ?? '').toLowerCase().includes(dashSearchLower) ||
          (a.ManagementIp ?? '').toLowerCase().includes(dashSearchLower)
        );
      })
    : assets;
  const dashSearchCount = dashSearchResults.length;
  const dashSearchLimited = dashSearchResults.slice(0, 100);
  const dashSearchHasMore = dashSearchResults.length > 100;
  const dashShowNoResults = dashSearchLower.length > 0 && dashSearchResults.length === 0;
  const dashShowTooMany = dashSearchHasMore;
  const dashShowResults = dashSearchLower.length > 0;

  // Asset handlers
  function validateAsset(): boolean {
    if (!assetName || !assetType || !serialNumber || !vendor || !purchaseDate) {
      setAssetError('Name, type, serial number, vendor and purchase date are required.');
      return false;
    }
    setAssetError(null);
    return true;
  }

  async function submitAsset() {
    if (!validateAsset()) return;
    try {
      setAssetSubmitting(true);
      setAssetError(null);
      await createAsset(
        {
          name: assetName,
          type: assetType,
          serialNumber,
          vendor,
          purchaseDate,
          warrantyExpiry: warrantyExpiry || null,
          room: assetRoom || null,
          rack: assetRack || null,
          rackUnit: assetRackUnit || null,
          managementIp: assetManagementIp || null,
          status: assetStatus,
        },
        assetInvoiceFile,
        assetInvoiceNumber || null
      );
      setAssetName('');
      setAssetType('');
      setAssetStatus('In Service');
      setSerialNumber('');
      setVendor('');
      setPurchaseDate('');
      setWarrantyExpiry('');
      setAssetRoom('');
      setAssetRack('');
      setAssetRackUnit('');
      setAssetManagementIp('');
      setAssetInvoiceFile(null);
      setAssetInvoiceNumber('');
      setAssetStep('form');
      await refreshAssets();
    } catch (e: any) {
      setAssetError(e.message ?? 'Failed to create asset');
    } finally {
      setAssetSubmitting(false);
    }
  }

  function onAssetPreview(e: FormEvent) {
    e.preventDefault();
    if (validateAsset()) setAssetStep('preview');
  }

  function startEditAsset(asset: Asset) {
    setEditingAssetId(asset.Id);
    setShowAddAssetForm(true);
    setAssetStep('form');
    setAssetName(asset.Name);
    setAssetType(asset.Type);
    setAssetStatus(asset.Status);
    setSerialNumber(asset.SerialNumber);
    setVendor(asset.Vendor);
    setPurchaseDate(asset.PurchaseDate);
    setWarrantyExpiry(asset.WarrantyExpiry ?? '');
    setAssetRoom(asset.Room ?? '');
    setAssetRack(asset.Rack ?? '');
    setAssetRackUnit(asset.RackUnit ?? '');
    setAssetManagementIp(asset.ManagementIp ?? '');
    setAssetInvoiceFile(null);
    setAssetInvoiceNumber(asset.InvoiceNumber ?? '');
    setRemoveAssetInvoice(false);
    setAssetError(null);
  }

  async function saveAssetEdit() {
    if (editingAssetId == null) return;
    if (!validateAsset()) return;
    try {
      setAssetSubmitting(true);
      setAssetError(null);
      await updateAsset(editingAssetId, {
        name: assetName,
        type: assetType,
        serialNumber,
        vendor,
        purchaseDate,
        warrantyExpiry: warrantyExpiry || null,
        room: assetRoom || null,
        rack: assetRack || null,
        rackUnit: assetRackUnit || null,
        managementIp: assetManagementIp || null,
        status: assetStatus,
      });
      if (assetInvoiceFile) {
        await uploadAssetInvoice(editingAssetId, assetInvoiceFile, assetInvoiceNumber.trim() || null);
      } else if (removeAssetInvoice) {
        await deleteAssetInvoice(editingAssetId);
      }
      setEditingAssetId(null);
      setShowAddAssetForm(false);
      setAssetName('');
      setAssetType('');
      setAssetStatus('In Service');
      setSerialNumber('');
      setVendor('');
      setPurchaseDate('');
      setWarrantyExpiry('');
      setAssetRoom('');
      setAssetRack('');
      setAssetRackUnit('');
      setAssetManagementIp('');
      setAssetInvoiceFile(null);
      setAssetInvoiceNumber('');
      setRemoveAssetInvoice(false);
      setAssetStep('form');
      await refreshAssets();
    } catch (e: any) {
      setAssetError(e.message ?? 'Failed to update asset');
    } finally {
      setAssetSubmitting(false);
    }
  }



  // Repair handlers
  async function onRepairSubmit(e: FormEvent) {
    e.preventDefault();
    if (!repairAssetId || !issueDescription.trim()) return;
    try {
      setRepairSubmitting(true);
      setRepairError(null);
      await createRepair({
        assetId: Number(repairAssetId),
        issueDescription: issueDescription.trim(),
        repairVendor: repairVendor.trim() || null,
        cost: repairCost !== '' ? Number(repairCost) : null,
      });
      setRepairAssetId('');
      setRepairAssetSearchQuery('');
      setIssueDescription('');
      setRepairVendor('');
      setRepairCost('');
      setShowLogRepairForm(false);
      await refreshRepairs();
      await refreshAssets();
    } catch (e: any) {
      setRepairError(e.message ?? 'Failed to create repair');
    } finally {
      setRepairSubmitting(false);
    }
  }

  async function onCompleteRepair(id: number) {
    try {
      setCompletingId(id);
      setRepairError(null);
      await completeRepair(id);
      await refreshRepairs();
      await refreshAssets();
    } catch (e: any) {
      setRepairError(e.message ?? 'Failed to complete repair');
    } finally {
      setCompletingId(null);
    }
  }

  function onRepairSearch(e: FormEvent) {
    e.preventDefault();
    setRepairSearchApplied(repairSearchQuery.trim());
  }

  const repairSearchLower = repairSearchApplied.toLowerCase();
  const filteredRepairs = repairSearchLower
    ? repairs.filter((r) => {
        const assetName = (r.AssetName ?? '').toLowerCase();
        const assetSerial = (r.AssetSerial ?? '').toLowerCase();
        const issue = (r.IssueDescription ?? '').toLowerCase();
        const vendor = (r.RepairVendor ?? '').toLowerCase();
        const status = (r.Status ?? '').toLowerCase();
        const start = (r.StartDate ?? '').toLowerCase();
        const completed = (r.CompletedDate ?? '').toLowerCase();
        const cost = r.Cost != null ? String(r.Cost) : '';
        return (
          assetName.includes(repairSearchLower) ||
          assetSerial.includes(repairSearchLower) ||
          issue.includes(repairSearchLower) ||
          vendor.includes(repairSearchLower) ||
          status.includes(repairSearchLower) ||
          start.includes(repairSearchLower) ||
          completed.includes(repairSearchLower) ||
          cost.includes(repairSearchLower)
        );
      })
    : repairs;
  const editingAsset = editingAssetId != null ? assets.find((a) => a.Id === editingAssetId) ?? null : null;

  if (authChecking) {
    return (
      <div className="app">
        <div className="login-screen">
          <p>Checking login…</p>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="app">
        <div className="login-screen">
          <div className="login-card">
            <img src="/CBLlogo.jpg" alt="City Brokerage" className="login-logo" />
            <h1>Data Center Inventory</h1>
            {needSetup === null ? (
              <p style={{ margin: '1rem 0' }}>Loading…</p>
            ) : needSetup ? (
              <>
                <h2>Create admin account</h2>
                <p className="login-hint">No admin exists yet. Create the first account to sign in.</p>
                <form
                  onSubmit={async (e: FormEvent<HTMLFormElement>) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const un = (form.querySelector('[name="username"]') as HTMLInputElement)?.value?.trim() ?? '';
                    const pw = (form.querySelector('[name="password"]') as HTMLInputElement)?.value ?? '';
                    if (!un || !pw) {
                      setLoginError('Username and password are required');
                      return;
                    }
                    if (pw.length < 6) {
                      setLoginError('Password must be at least 6 characters');
                      return;
                    }
                    setLoginError(null);
                    setLoginSubmitting(true);
                    try {
                      const { token, user } = await setupFirstAdmin(un, pw);
                      setToken(token);
                      setAuthUser(user);
                    } catch (err: unknown) {
                      setLoginError(err instanceof Error ? err.message : 'Setup failed');
                    } finally {
                      setLoginSubmitting(false);
                    }
                  }}
                >
                  {loginError && <p className="error">{loginError}</p>}
                  <label>
                    Username
                    <input name="username" type="text" autoComplete="username" required disabled={loginSubmitting} />
                  </label>
                  <label>
                    Password (min 6 characters)
                    <input name="password" type="password" autoComplete="new-password" required disabled={loginSubmitting} minLength={6} />
                  </label>
                  <button type="submit" disabled={loginSubmitting}>
                    {loginSubmitting ? 'Creating…' : 'Create admin'}
                  </button>
                </form>
              </>
            ) : (
              <>
                <h2>Admin login</h2>
                <form
                  onSubmit={async (e: FormEvent<HTMLFormElement>) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const un = (form.querySelector('[name="username"]') as HTMLInputElement)?.value?.trim() ?? '';
                    const pw = (form.querySelector('[name="password"]') as HTMLInputElement)?.value ?? '';
                    if (!un || !pw) {
                      setLoginError('Username and password are required');
                      return;
                    }
                    setLoginError(null);
                    setLoginSubmitting(true);
                    try {
                      const { token, user } = await login(un, pw);
                      setToken(token);
                      setAuthUser(user);
                    } catch (err: unknown) {
                      setLoginError(err instanceof Error ? err.message : 'Login failed');
                    } finally {
                      setLoginSubmitting(false);
                    }
                  }}
                >
                  {loginError && <p className="error">{loginError}</p>}
                  <label>
                    Username
                    <input name="username" type="text" autoComplete="username" required disabled={loginSubmitting} />
                  </label>
                  <label>
                    Password
                    <input name="password" type="password" autoComplete="current-password" required disabled={loginSubmitting} />
                  </label>
                  <button type="submit" disabled={loginSubmitting}>
                    {loginSubmitting ? 'Signing in…' : 'Sign in'}
                  </button>
                </form>
              </>
            )}
          </div>
          <footer className="app-footer">
            Developed By CBL Information Technology Department
          </footer>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <img src="/CBLlogo.jpg" alt="City Brokerage - making sense of your investment" className="header-logo-img" />
          <h1>Data Center Inventory</h1>
        </div>
        <div className="header-right">
          <span className="header-user">Logged in as {authUser.username}</span>
          <button type="button" className="logout-btn" onClick={() => { clearToken(); setAuthUser(null); }}>
            Logout
          </button>
          <nav className="tabs">
            <button
              type="button"
              className={activeTab === 'dashboard' ? 'tab active' : 'tab'}
              onClick={() => setActiveTab('dashboard')}
            >
              Dashboard
            </button>
            <button
              type="button"
              className={activeTab === 'assets' ? 'tab active' : 'tab'}
              onClick={() => setActiveTab('assets')}
            >
              Assets
            </button>
            <button
              type="button"
              className={activeTab === 'repairs' ? 'tab active' : 'tab'}
              onClick={() => setActiveTab('repairs')}
            >
              Repairs
            </button>
            <button
              type="button"
              className={activeTab === 'licenses' ? 'tab active' : 'tab'}
              onClick={() => setActiveTab('licenses')}
            >
              Licenses
            </button>
          </nav>
        </div>
      </header>
      <datalist id="dc-equipment-types">
        <option value="Server" />
        <option value="Storage" />
        <option value="Network switch" />
        <option value="Router" />
        <option value="Firewall" />
        <option value="Load balancer" />
        <option value="Rack" />
        <option value="UPS" />
        <option value="PDU" />
        <option value="Cooling" />
        <option value="KVM" />
      </datalist>

      {activeTab === 'dashboard' && (
        <main className="app-main dashboard-main">
          {dashboardLoading ? (
            <p>Loading dashboard…</p>
          ) : dashboardError ? (
            <p className="error">{dashboardError}</p>
          ) : dashboardStats ? (
            <>
              <section className="dashboard-grid">
                <div className={dashShowResults ? 'card card-wide' : 'card'}>
                  <h2>Equipment search</h2>
                  <p className="dashboard-search-hint">Search equipment by name, type, serial, rack, room, management IP, or status.</p>
                  <div className="form-grid" style={{ marginBottom: '0.75rem' }}>
                    <label>
                      Search
                      <input
                        type="search"
                        value={dashSearchQuery}
                        onChange={(e) => setDashSearchQuery(e.target.value)}
                        placeholder="Name, type, serial, rack, room, IP, status…"
                        autoComplete="off"
                      />
                    </label>
                  </div>
                  {dashShowNoResults && (
                    <p className="error">No assets match your search.</p>
                  )}
                  {dashSearchCount > 0 && (
                    <p className="dashboard-result-count">
                      {dashSearchCount} asset{dashSearchCount !== 1 ? 's' : ''} found
                      {dashShowTooMany ? ' (showing first 100)' : ''}.
                    </p>
                  )}
                  {dashShowResults && dashSearchResults.length > 0 && (
                    <div className="dashboard-table-wrap" style={{ marginTop: '0.75rem' }}>
                      <table className="table dashboard-results-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Serial</th>
                            <th>Type</th>
                            <th>Status</th>
                            <th>Vendor</th>
                            <th>Location</th>
                            <th>Warranty expiry</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dashSearchLimited.map((asset) => (
                            <tr
                              key={asset.Id}
                              style={{ cursor: 'pointer' }}
                              onClick={() => { setActiveTab('assets'); setSelectedAssetId(asset.Id); }}
                            >
                              <td>{asset.Name}</td>
                              <td>{asset.SerialNumber}</td>
                              <td>{asset.Type}</td>
                              <td>{asset.Status}</td>
                              <td>{asset.Vendor}</td>
                              <td>{[asset.Room, asset.Rack, asset.RackUnit ? `U${asset.RackUnit}` : null].filter(Boolean).join(' / ') || '—'}</td>
                              <td>{asset.WarrantyExpiry ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div className="card">
                  <h2>Equipment by status</h2>
                  <div className="card-scroll">
                    <ul className="stat-list">
                      <li>In Service: {dashboardStats.assetsByStatus?.['In Service'] ?? 0}</li>
                      <li>In Repair: {dashboardStats.assetsByStatus?.Maintenance ?? 0}</li>
                    </ul>
                  </div>
                </div>
                <div className="card">
                  <h2>Asset warranty expiry</h2>
                  {!dashboardStats.upcomingWarranties?.length ? (
                    <p>No upcoming warranty expirations.</p>
                  ) : (
                    <div className="card-scroll">
                    <ul className="warranty-list">
                      {dashboardStats.upcomingWarranties.map((a) => {
                        const days = getRemainingDays(a.ExpiryDate);
                        const daysText = days !== null
                          ? days < 0
                            ? ` (${Math.abs(days)} days ago)`
                            : days === 0
                              ? ' (today)'
                              : ` (${days} days left)`
                          : '';
                        return (
                          <li key={a.Id}>
                            <strong>{a.Name}</strong> – Serial: <strong>{a.SerialNumber || '—'}</strong> – {a.Vendor} – Expiry: <strong>{a.ExpiryDate}</strong>{daysText}
                          </li>
                        );
                      })}
                    </ul>
                    </div>
                  )}
                </div>
                <div className="card">
                  <h2>License expiry</h2>
                  {licenses.filter((l) => l.ExpiryDate).length === 0 ? (
                    <p>No licenses with expiry dates.</p>
                  ) : (
                    <div className="card-scroll">
                    <ul className="warranty-list">
                      {[...licenses]
                        .filter((l) => l.ExpiryDate)
                        .sort((a, b) => a.ExpiryDate.localeCompare(b.ExpiryDate))
                        .map((lic) => {
                          const days = getRemainingDays(lic.ExpiryDate);
                          const daysText = days !== null
                            ? days < 0
                              ? ` (${Math.abs(days)} days ago)`
                              : days === 0
                                ? ' (today)'
                                : ` (${days} days left)`
                            : '';
                          return (
                            <li key={lic.Id}>
                              <strong>{lic.Name}</strong> – {lic.Vendor} – Expiry: <strong>{lic.ExpiryDate}</strong>{daysText}
                            </li>
                          );
                        })}
                    </ul>
                    </div>
                  )}
                </div>
                {/* Recent repair activity removed from dashboard */}
              </section>
            </>
          ) : null}
        </main>
      )}
      {activeTab === 'assets' && (
        <main className="app-main assets-full-page">
          <div className="assets-actions-corner">
            <button
              type="button"
              className={!showAddAssetForm ? 'tab active' : 'tab'}
              onClick={() => setShowAddAssetForm(false)}
              style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #fecaca', cursor: 'pointer', fontWeight: 500, background: !showAddAssetForm ? '#dc2626' : 'transparent', color: !showAddAssetForm ? 'white' : '#6b7280' }}
            >
              View assets
            </button>
            <button
              type="button"
              className={showAddAssetForm ? 'tab active' : 'tab'}
              onClick={() => setShowAddAssetForm(true)}
              style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #fecaca', cursor: 'pointer', fontWeight: 500, background: showAddAssetForm ? '#dc2626' : 'transparent', color: showAddAssetForm ? 'white' : '#6b7280' }}
            >
              Add equipment
            </button>
            {!showAddAssetForm && authUser?.role === 'Admin' && (
              <button
                type="button"
                onClick={() => onEmailInventory('assets', selectedAssetReportIds)}
                disabled={inventoryEmailSending || selectedAssetReportIds.length === 0}
              >
                {inventoryEmailSending && inventoryEmailTarget === 'assets' ? 'Sending…' : `Email selected (${selectedAssetReportIds.length})`}
              </button>
            )}
          </div>
          {!showAddAssetForm && inventoryEmailTarget === 'assets' && inventoryEmailMessage && (
            <p role="status">{inventoryEmailMessage}</p>
          )}
          {!showAddAssetForm && inventoryEmailTarget === 'assets' && inventoryEmailError && (
            <p className="error" role="alert">{inventoryEmailError}</p>
          )}

          {showAddAssetForm && (
          <section className="card">
            <h2>{editingAssetId != null ? 'Edit equipment' : 'Add equipment'}</h2>
            {editingAssetId != null ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  saveAssetEdit();
                }}
                className="form-grid"
              >
                <label>
                  Name
                  <input value={assetName} onChange={(e) => setAssetName(e.target.value)} required />
                </label>
                <label>
                  Equipment type
                  <input
                    list="dc-equipment-types"
                    value={assetType}
                    onChange={(e) => setAssetType(e.target.value)}
                    placeholder="e.g. Server, switch, UPS"
                    required
                  />
                </label>
                <label>
                  Operational status
                  <select value={assetStatus} onChange={(e) => setAssetStatus(e.target.value)}>
                    <option>In Service</option>
                    <option>Spare</option>
                    <option>Maintenance</option>
                    <option>Decommissioned</option>
                  </select>
                </label>
                <label>
                  Serial number
                  <input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} required />
                </label>
                <label>
                  Vendor
                  <input value={vendor} onChange={(e) => setVendor(e.target.value)} required />
                </label>
                <label>
                  Purchase date
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
                    required
                  />
                </label>
                <label>
                  Warranty expiry
                  <input
                    type="date"
                    value={warrantyExpiry}
                    onChange={(e) => setWarrantyExpiry(e.target.value)}
                    onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
                  />
                </label>
                <label>
                  Room / area
                  <input value={assetRoom} onChange={(e) => setAssetRoom(e.target.value)} placeholder="e.g. Server room A" />
                </label>
                <label>
                  Rack
                  <input value={assetRack} onChange={(e) => setAssetRack(e.target.value)} placeholder="e.g. R01" />
                </label>
                <label>
                  Rack position (U)
                  <input value={assetRackUnit} onChange={(e) => setAssetRackUnit(e.target.value)} placeholder="e.g. 12-14" />
                </label>
                <label>
                  Management IP
                  <input value={assetManagementIp} onChange={(e) => setAssetManagementIp(e.target.value)} placeholder="e.g. 10.0.0.15" inputMode="decimal" />
                </label>
                <label>
                  Invoice number
                  <input
                    type="text"
                    value={assetInvoiceNumber}
                    onChange={(e) => setAssetInvoiceNumber(e.target.value)}
                    placeholder="e.g. INV-001"
                  />
                </label>
                <div>
                  <strong>Current invoice</strong>
                  <div style={{ marginTop: '0.35rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {editingAsset?.InvoicePath && !removeAssetInvoice ? (
                      <>
                        <a href={getInvoiceUrl(editingAsset.Id)} target="_blank" rel="noopener noreferrer">
                          View current PDF
                        </a>
                        {authUser?.role === 'Admin' && (
                          <button
                            type="button"
                            onClick={() => setRemoveAssetInvoice(true)}
                            style={{ marginTop: 0 }}
                          >
                            Remove PDF
                          </button>
                        )}
                      </>
                    ) : removeAssetInvoice ? (
                      <>
                        <span>Current PDF will be removed when you save.</span>
                        <button
                          type="button"
                          onClick={() => setRemoveAssetInvoice(false)}
                          style={{ marginTop: 0 }}
                        >
                          Undo remove
                        </button>
                      </>
                    ) : (
                      <span>No PDF uploaded.</span>
                    )}
                  </div>
                </div>
                <label>
                  New PDF (optional)
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={(e) => setAssetInvoiceFile(e.target.files?.[0] ?? null)}
                  />
                  {assetInvoiceFile && (
                    <span style={{ marginLeft: '0.5rem', fontSize: '0.9em' }}>
                      {assetInvoiceFile.name}
                    </span>
                  )}
                </label>
                <div className="preview-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAssetId(null);
                      setShowAddAssetForm(false);
                      setAssetError(null);
                      setAssetName('');
                      setAssetType('');
                      setAssetStatus('In Service');
                      setSerialNumber('');
                      setVendor('');
                      setPurchaseDate('');
                      setWarrantyExpiry('');
                      setAssetRoom('');
                      setAssetRack('');
                      setAssetRackUnit('');
                      setAssetManagementIp('');
                      setAssetInvoiceFile(null);
                      setAssetInvoiceNumber('');
                      setRemoveAssetInvoice(false);
                    }}
                  >
                    Cancel
                  </button>
                  <button type="submit" disabled={assetSubmitting}>
                    {assetSubmitting ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </form>
            ) : assetStep === 'form' ? (
              <form onSubmit={onAssetPreview} className="form-grid">
                <label>
                  Name
                  <input value={assetName} onChange={(e) => setAssetName(e.target.value)} required />
                </label>
                <label>
                  Equipment type
                  <input
                    list="dc-equipment-types"
                    value={assetType}
                    onChange={(e) => setAssetType(e.target.value)}
                    placeholder="e.g. Server, switch, UPS"
                    required
                  />
                </label>
                <label>
                  Operational status
                  <select value={assetStatus} onChange={(e) => setAssetStatus(e.target.value)}>
                    <option>In Service</option>
                    <option>Spare</option>
                    <option>Maintenance</option>
                    <option>Decommissioned</option>
                  </select>
                </label>
                <label>
                  Serial number
                  <input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} required />
                </label>
                <label>
                  Vendor
                  <input value={vendor} onChange={(e) => setVendor(e.target.value)} required />
                </label>
                <label>
                  Purchase date
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
                    required
                  />
                </label>
                <label>
                  Warranty expiry
                  <input
                    type="date"
                    value={warrantyExpiry}
                    onChange={(e) => setWarrantyExpiry(e.target.value)}
                    onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
                  />
                </label>
                <label>
                  Room / area
                  <input value={assetRoom} onChange={(e) => setAssetRoom(e.target.value)} placeholder="e.g. Server room A" />
                </label>
                <label>
                  Rack
                  <input value={assetRack} onChange={(e) => setAssetRack(e.target.value)} placeholder="e.g. R01" />
                </label>
                <label>
                  Rack position (U)
                  <input value={assetRackUnit} onChange={(e) => setAssetRackUnit(e.target.value)} placeholder="e.g. 12-14" />
                </label>
                <label>
                  Management IP
                  <input value={assetManagementIp} onChange={(e) => setAssetManagementIp(e.target.value)} placeholder="e.g. 10.0.0.15" inputMode="decimal" />
                </label>
                <label>
                  Invoice number (optional)
                  <input
                    type="text"
                    value={assetInvoiceNumber}
                    onChange={(e) => setAssetInvoiceNumber(e.target.value)}
                    placeholder="e.g. INV-001"
                  />
                </label>
                <label>
                  Invoice (PDF, optional)
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={(e) => setAssetInvoiceFile(e.target.files?.[0] ?? null)}
                  />
                  {assetInvoiceFile && (
                    <span style={{ marginLeft: '0.5rem', fontSize: '0.9em' }}>
                      {assetInvoiceFile.name}
                    </span>
                  )}
                </label>
                <button type="submit">Preview</button>
              </form>
            ) : (
              <div className="preview-card">
                <h3>Preview</h3>
                <dl className="preview-dl">
                  <dt>Name</dt><dd>{assetName}</dd>
                  <dt>Equipment type</dt><dd>{assetType}</dd>
                  <dt>Operational status</dt><dd>{assetStatus}</dd>
                  <dt>Serial number</dt><dd>{serialNumber}</dd>
                  <dt>Vendor</dt><dd>{vendor}</dd>
                  <dt>Purchase date</dt><dd>{purchaseDate}</dd>
                  <dt>Warranty expiry</dt><dd>{warrantyExpiry || '—'}</dd>
                  <dt>Room / area</dt><dd>{assetRoom || '—'}</dd>
                  <dt>Rack / U</dt><dd>{[assetRack, assetRackUnit ? `U${assetRackUnit}` : null].filter(Boolean).join(' / ') || '—'}</dd>
                  <dt>Management IP</dt><dd>{assetManagementIp || '—'}</dd>
                  <dt>Invoice number</dt><dd>{assetInvoiceNumber || '—'}</dd>
                  <dt>Invoice PDF</dt><dd>{assetInvoiceFile ? assetInvoiceFile.name : '—'}</dd>
                </dl>
                <div className="preview-actions">
                  <button type="button" onClick={() => setAssetStep('form')}>Edit</button>
                  <button type="button" onClick={() => submitAsset()} disabled={assetSubmitting}>
                    {assetSubmitting ? 'Saving…' : 'Add equipment'}
                  </button>
                </div>
              </div>
            )}
          </section>
          )}

          {!showAddAssetForm && (
          <div className="assets-table-wrap">
          <section className="card">
            <h2>Assets</h2>
            {selectedAssetId != null ? (
              (() => {
                const asset = assets.find((a) => a.Id === selectedAssetId);
                if (!asset) return <p>Asset not found.</p>;
                return (
                  <div>
                    <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => setSelectedAssetId(null)}>
                        ← Back to list
                      </button>
                      <button type="button" onClick={() => { startEditAsset(asset); setSelectedAssetId(null); }}>
                        Edit
                      </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.5rem 1.5rem', maxWidth: '32rem' }}>
                      <strong>Name</strong><span>{asset.Name}</span>
                      <strong>Type</strong><span>{asset.Type}</span>
                      <strong>Serial number</strong><span>{asset.SerialNumber}</span>
                      <strong>Status</strong><span>{asset.Status}</span>
                      <strong>Vendor</strong><span>{asset.Vendor}</span>
                      <strong>Purchase date</strong><span>{asset.PurchaseDate}</span>
                      <strong>Warranty expiry</strong><span>{asset.WarrantyExpiry ?? '—'}</span>
                      <strong>Room / area</strong><span>{asset.Room ?? '—'}</span>
                      <strong>Rack / U</strong><span>{[asset.Rack, asset.RackUnit ? `U${asset.RackUnit}` : null].filter(Boolean).join(' / ') || '—'}</span>
                      <strong>Management IP</strong><span>{asset.ManagementIp ?? '—'}</span>
                      <strong>Invoice number</strong><span>{asset.InvoiceNumber ?? '—'}</span>
                      <strong>Invoice</strong>
                      <span>
                        {asset.InvoicePath ? (
                          <a href={getInvoiceUrl(asset.Id)} target="_blank" rel="noopener noreferrer">
                            View invoice PDF
                          </a>
                        ) : '—'}
                      </span>
                    </div>
                  </div>
                );
              })()
            ) : assetLoading ? (
              <p>Loading…</p>
            ) : assets.length === 0 ? (
              <p>No assets yet.</p>
            ) : (
              <>
                <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="search"
                    placeholder="Search by name, type, serial, room, rack, IP, status, vendor…"
                    value={assetSearchQuery}
                    onChange={(e) => setAssetSearchQuery(e.target.value)}
                    style={{ flex: '1', minWidth: '12rem', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #fca5a5', background: '#fff', color: '#1f2937' }}
                  />
                </div>
                {(() => {
                  const q = assetSearchQuery.trim().toLowerCase();
                  const filtered = q
                    ? assets.filter((a) => {
                        return (
                          a.Name.toLowerCase().includes(q) ||
                          a.Type.toLowerCase().includes(q) ||
                          a.SerialNumber.toLowerCase().includes(q) ||
                          a.Status.toLowerCase().includes(q) ||
                          (a.Room ?? '').toLowerCase().includes(q) ||
                          (a.Rack ?? '').toLowerCase().includes(q) ||
                          (a.RackUnit ?? '').toLowerCase().includes(q) ||
                          (a.ManagementIp ?? '').toLowerCase().includes(q) ||
                          a.Vendor.toLowerCase().includes(q)
                        );
                      })
                    : assets;
                  const sorted = [...filtered].sort((a, b) => {
                    let va: string | number = '';
                    let vb: string | number = '';
                    va = a[assetSortBy] ?? '';
                    vb = b[assetSortBy] ?? '';
                    const cmp = String(va).localeCompare(String(vb), undefined, { sensitivity: 'base' });
                    return assetSortDir === 'asc' ? cmp : -cmp;
                  });
                  const displayAssets = sorted;
                  const sortTh = (col: typeof assetSortBy, label: string) => (
                    <th
                      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                      onClick={() => {
                        setAssetSortBy(col);
                        setAssetSortDir((d) => (assetSortBy === col ? (d === 'asc' ? 'desc' : 'asc') : 'asc'));
                      }}
                    >
                      {label} {assetSortBy === col ? (assetSortDir === 'asc' ? '↑' : '↓') : ''}
                    </th>
                  );
                  return (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          aria-label="Select all visible equipment"
                          checked={displayAssets.length > 0 && displayAssets.every((asset) => selectedAssetReportIds.includes(asset.Id))}
                          onChange={(e) => setSelectedAssetReportIds((current) => (
                            e.target.checked
                              ? [...new Set([...current, ...displayAssets.map((asset) => asset.Id)])]
                              : current.filter((id) => !displayAssets.some((asset) => asset.Id === id))
                          ))}
                        />
                      </th>
                      {sortTh('Name', 'Name')}
                      {sortTh('Type', 'Type')}
                      {sortTh('SerialNumber', 'Serial')}
                      {sortTh('Status', 'Status')}
                      {sortTh('Vendor', 'Vendor')}
                      <th>Room / rack / U</th>
                      <th>Management IP</th>
                      <th>Purchase</th>
                      <th>Warranty</th>
                      <th>Invoice</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {displayAssets.length === 0 ? (
                      <tr><td colSpan={12} style={{ textAlign: 'center', padding: '1.5rem', color: '#6b7280' }}>No equipment matches your search.</td></tr>
                    ) : displayAssets.map((asset) => (
                      <tr
                        key={asset.Id}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedAssetId(asset.Id)}
                      >
                        <td onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            aria-label={`Select ${asset.Name} for email`}
                            checked={selectedAssetReportIds.includes(asset.Id)}
                            onChange={(e) => setSelectedAssetReportIds((current) => (
                              e.target.checked
                                ? [...current, asset.Id]
                                : current.filter((id) => id !== asset.Id)
                            ))}
                          />
                        </td>
                        <td>{asset.Name}</td>
                        <td>{asset.Type}</td>
                        <td>{asset.SerialNumber}</td>
                        <td>{asset.Status}</td>
                        <td>{asset.Vendor}</td>
                        <td>{[asset.Room, asset.Rack, asset.RackUnit ? `U${asset.RackUnit}` : null].filter(Boolean).join(' / ') || '—'}</td>
                        <td>{asset.ManagementIp ?? '—'}</td>
                        <td>{asset.PurchaseDate}</td>
                        <td>{asset.WarrantyExpiry ?? '-'}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          {asset.InvoicePath ? (
                            <span>
                              <a href={getInvoiceUrl(asset.Id)} target="_blank" rel="noopener noreferrer">
                                {asset.InvoiceNumber || 'View invoice'}
                              </a>
                            </span>
                          ) : (
                            <>
                              <input
                                type="text"
                                value={invoiceNumberByAsset[asset.Id] ?? ''}
                                onChange={(e) =>
                                  setInvoiceNumberByAsset((prev) => ({
                                    ...prev,
                                    [asset.Id]: e.target.value,
                                  }))
                                }
                                placeholder="Invoice #"
                                style={{ width: '6rem', marginRight: '0.25rem' }}
                              />
                              <input
                                type="file"
                                accept=".pdf,application/pdf"
                                id={`invoice-${asset.Id}`}
                                style={{ display: 'none' }}
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) {
                                    setUploadingInvoiceId(asset.Id);
                                    const invNum = invoiceNumberByAsset[asset.Id]?.trim() || null;
                                    uploadAssetInvoice(asset.Id, f, invNum)
                                      .then(async () => {
                                        setInvoiceNumberByAsset((prev) => ({ ...prev, [asset.Id]: '' }));
                                        await refreshAssets();
                                      })
                                      .catch((err) => setAssetError(err.message ?? 'Upload failed'))
                                      .finally(() => {
                                        setUploadingInvoiceId(null);
                                        e.target.value = '';
                                      });
                                  }
                                }}
                              />
                              <button
                                type="button"
                                disabled={uploadingInvoiceId === asset.Id}
                                onClick={() => (document.getElementById(`invoice-${asset.Id}`) as HTMLInputElement | null)?.click()}
                              >
                                {uploadingInvoiceId === asset.Id ? 'Uploading…' : 'Upload PDF'}
                              </button>
                            </>
                          )}
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="actions asset-row-actions">
                            <button type="button" onClick={(e) => { e.stopPropagation(); startEditAsset(asset); }}>
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
                  );
                })()}
              </>
            )}
            {assetError && <p className="error">{assetError}</p>}
          </section>
          </div>
          )}
        </main>
      )}
      {activeTab === 'repairs' && (
        <main className="app-main repairs-full-page">
          {showLogRepairForm ? (
            <section className="card repairs-form-card">
              <h2>Log repair</h2>
              <form onSubmit={onRepairSubmit} className="form-grid">
                <label>
                  Asset
                  <input
                    type="search"
                    value={repairAssetSearchQuery}
                    onChange={(e) => {
                      setRepairAssetSearchQuery(e.target.value);
                      setRepairAssetId('');
                    }}
                    placeholder="Search by name, serial number, or type"
                    aria-label="Search assets for repair"
                  />
                  <select
                    value={repairAssetId}
                    onChange={(e) => setRepairAssetId(e.target.value ? Number(e.target.value) : '')}
                    required
                  >
                    <option value="">Select asset…</option>
                    {assets
                      .filter((a) => {
                        if (a.Status === 'Maintenance') return false;
                        const query = repairAssetSearchQuery.trim().toLowerCase();
                        return !query || [a.Name, a.SerialNumber, a.Type, a.Status]
                          .some((value) => value.toLowerCase().includes(query));
                      })
                      .map((a) => (
                        <option key={a.Id} value={a.Id}>
                          {a.Name} ({a.SerialNumber}) – {a.Status}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Issue description
                  <textarea
                    value={issueDescription}
                    onChange={(e) => setIssueDescription(e.target.value)}
                    rows={3}
                    required
                  />
                </label>
                <label>
                  Repair vendor
                  <input value={repairVendor} onChange={(e) => setRepairVendor(e.target.value)} />
                </label>
                <label>
                  Cost
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={repairCost}
                    onChange={(e) => setRepairCost(e.target.value)}
                  />
                </label>
                <div className="preview-actions">
                  <button type="button" onClick={() => { setShowLogRepairForm(false); setRepairError(null); }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={repairSubmitting}>
                    {repairSubmitting ? 'Saving…' : 'Log repair'}
                  </button>
                </div>
              </form>
              {repairError && <p className="error">{repairError}</p>}
            </section>
          ) : (
            <>
              <div className="repairs-actions-corner">
                <form onSubmit={onRepairSearch} className="repairs-search-form">
                  <input
                    type="search"
                    placeholder="Search by asset, issue, vendor, status, date…"
                    value={repairSearchQuery}
                    onChange={(e) => setRepairSearchQuery(e.target.value)}
                    className="repairs-search-input"
                    aria-label="Search repairs"
                  />
                  <button type="submit">Search</button>
                </form>
                <button type="button" onClick={() => setShowLogRepairForm(true)}>
                  Create log
                </button>
              </div>
              <div className="repairs-table-wrap">
                <section className="card">
                  <h2>Repairs</h2>
                  {repairSearchApplied && (
                    <p className="repairs-search-hint">
                      {filteredRepairs.length === 0
                        ? 'No repairs match your search.'
                        : `${filteredRepairs.length} repair${filteredRepairs.length !== 1 ? 's' : ''} found.`}
                    </p>
                  )}
                  {repairLoading ? (
                    <p>Loading…</p>
                  ) : repairs.length === 0 ? (
                    <p>No repairs yet. Click &quot;Create log&quot; to add one.</p>
                  ) : (
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Asset</th>
                          <th>Issue</th>
                          <th>Vendor</th>
                          <th>Cost</th>
                          <th>Status</th>
                          <th>Start</th>
                          <th>Completed</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRepairs.map((r) => (
                          <tr key={r.Id}>
                            <td>{r.AssetName ?? r.AssetId} {r.AssetSerial && `(${r.AssetSerial})`}</td>
                            <td>{r.IssueDescription}</td>
                            <td>{r.RepairVendor ?? '-'}</td>
                            <td>{r.Cost != null ? r.Cost : '-'}</td>
                            <td>{r.Status}</td>
                            <td>{r.StartDate}</td>
                            <td>{r.CompletedDate ?? '-'}</td>
                            <td>
                              {r.Status !== 'Completed' && (
                                <button
                                  type="button"
                                  onClick={() => onCompleteRepair(r.Id)}
                                  disabled={completingId === r.Id}
                                >
                                  {completingId === r.Id ? 'Completing…' : 'Complete'}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {repairError && <p className="error">{repairError}</p>}
                </section>
              </div>
            </>
          )}
        </main>
      )}
      {activeTab === 'licenses' && (
        <main className="app-main">
          <section className="card">
            <h2>{editingLicenseId != null ? 'Edit license' : 'Add software license'}</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!licenseName || !licenseVendor || !licensePurchaseDate || !licenseExpiryDate || !licenseCost) {
                  setLicenseError('All fields are required.');
                  return;
                }
                const costNumber = Number(licenseCost);
                if (Number.isNaN(costNumber)) {
                  setLicenseError('Cost must be a number.');
                  return;
                }
                (async () => {
                  try {
                    setLicenseSubmitting(true);
                    setLicenseError(null);
                    if (editingLicenseId == null) {
                      await createLicense({
                        name: licenseName,
                        vendor: licenseVendor,
                        purchaseDate: licensePurchaseDate,
                        expiryDate: licenseExpiryDate,
                        cost: costNumber,
                      });
                    } else {
                      await updateLicense(editingLicenseId, {
                        name: licenseName,
                        vendor: licenseVendor,
                        purchaseDate: licensePurchaseDate,
                        expiryDate: licenseExpiryDate,
                        cost: costNumber,
                      });
                    }
                    const data = await listLicenses();
                    setLicenses(data);
                    setEditingLicenseId(null);
                    setLicenseName('');
                    setLicenseVendor('');
                    setLicensePurchaseDate('');
                    setLicenseExpiryDate('');
                    setLicenseCost('');
                  } catch (err: any) {
                    setLicenseError(err.message ?? 'Failed to save license');
                  } finally {
                    setLicenseSubmitting(false);
                  }
                })();
              }}
              className="form-grid"
            >
              <label>
                Software / license name
                <input value={licenseName} onChange={(e) => setLicenseName(e.target.value)} required />
              </label>
              <label>
                Vendor
                <input value={licenseVendor} onChange={(e) => setLicenseVendor(e.target.value)} required />
              </label>
              <label>
                Purchase date
                <input
                  type="date"
                  value={licensePurchaseDate}
                  onChange={(e) => setLicensePurchaseDate(e.target.value)}
                  onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
                  required
                />
              </label>
              <label>
                Expiry date
                <input
                  type="date"
                  value={licenseExpiryDate}
                  onChange={(e) => setLicenseExpiryDate(e.target.value)}
                  onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
                  required
                />
              </label>
              <label>
                Cost
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={licenseCost}
                  onChange={(e) => setLicenseCost(e.target.value)}
                  required
                />
              </label>
              <div className="preview-actions">
                {editingLicenseId != null && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingLicenseId(null);
                      setLicenseError(null);
                      setLicenseName('');
                      setLicenseVendor('');
                      setLicensePurchaseDate('');
                      setLicenseExpiryDate('');
                      setLicenseCost('');
                    }}
                  >
                    Cancel
                  </button>
                )}
                <button type="submit" disabled={licenseSubmitting}>
                  {licenseSubmitting ? 'Saving…' : editingLicenseId != null ? 'Save' : 'Add license'}
                </button>
              </div>
            </form>
            {licenseError && <p className="error">{licenseError}</p>}
          </section>

          <section className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <h2>Software licenses</h2>
              {authUser?.role === 'Admin' && (
                <button
                  type="button"
                  onClick={() => onEmailInventory('licenses', selectedLicenseReportIds)}
                  disabled={inventoryEmailSending || selectedLicenseReportIds.length === 0}
                >
                  {inventoryEmailSending && inventoryEmailTarget === 'licenses' ? 'Sending…' : `Email selected (${selectedLicenseReportIds.length})`}
                </button>
              )}
            </div>
            {inventoryEmailTarget === 'licenses' && inventoryEmailMessage && (
              <p role="status">{inventoryEmailMessage}</p>
            )}
            {inventoryEmailTarget === 'licenses' && inventoryEmailError && (
              <p className="error" role="alert">{inventoryEmailError}</p>
            )}
            {licenseLoading ? (
              <p>Loading…</p>
            ) : licenses.length === 0 ? (
              <p>No licenses yet.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        aria-label="Select all software licenses"
                        checked={licenses.length > 0 && licenses.every((license) => selectedLicenseReportIds.includes(license.Id))}
                        onChange={(e) => setSelectedLicenseReportIds(e.target.checked ? licenses.map((license) => license.Id) : [])}
                      />
                    </th>
                    <th>Name</th>
                    <th>Vendor</th>
                    <th>Purchase date</th>
                    <th>Expiry date</th>
                    <th>Cost</th>
                    <th>Added</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {licenses.map((lic) => (
                    <tr key={lic.Id}>
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${lic.Name} for email`}
                          checked={selectedLicenseReportIds.includes(lic.Id)}
                          onChange={(e) => setSelectedLicenseReportIds((current) => (
                            e.target.checked
                              ? [...current, lic.Id]
                              : current.filter((id) => id !== lic.Id)
                          ))}
                        />
                      </td>
                      <td>{lic.Name}</td>
                      <td>{lic.Vendor}</td>
                      <td>{lic.PurchaseDate}</td>
                      <td>{lic.ExpiryDate}</td>
                      <td>{lic.Cost}</td>
                      <td>{lic.CreatedAt}</td>
                      <td>
                        <div className="actions">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingLicenseId(lic.Id);
                              setLicenseName(lic.Name);
                              setLicenseVendor(lic.Vendor);
                              setLicensePurchaseDate(lic.PurchaseDate);
                              setLicenseExpiryDate(lic.ExpiryDate);
                              setLicenseCost(String(lic.Cost));
                            }}
                          >
                            Edit
                          </button>
                          {authUser?.role === 'Admin' && (
                            <button
                              type="button"
                              className="danger"
                              onClick={async () => {
                                if (!confirm('Delete this license?')) return;
                                try {
                                  setLicenseError(null);
                                  await deleteLicense(lic.Id);
                                  const data = await listLicenses();
                                  setLicenses(data);
                                } catch (err: any) {
                                  setLicenseError(err.message ?? 'Failed to delete license');
                                }
                              }}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </main>
      )}
      {activeTab === 'dashboard' && (
        <footer className="app-footer">
          Developed By CBL Information Technology Department
        </footer>
      )}
    </div>
  );
}

export default App;
