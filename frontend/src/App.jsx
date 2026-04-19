import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import CredentialsGate from './components/CredentialsGate';
import Dashboard from './pages/Dashboard';
import Services from './pages/Services';
import CostExplorer from './pages/CostExplorer';
import HiddenCharges from './pages/HiddenCharges';
import Invoice from './pages/Invoice';
import Settings from './pages/Settings';
import Mapper from './pages/Mapper';
import Hygiene from './pages/Hygiene';
import Rightsizing from './pages/Rightsizing';
import Aggregator from './pages/Aggregator';
import Organizations from './pages/Organizations';
import EC2 from './pages/services/EC2';
import RDS from './pages/services/RDS';
import S3 from './pages/services/S3';
import Others from './pages/services/Others';
import BillingOverview from './pages/billing/Overview';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <CredentialsGate>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="services" element={<Navigate to="/services/ec2" replace />} />
              <Route path="costs"    element={<Navigate to="/billing/overview" replace />} />
              <Route path="hidden" element={<HiddenCharges />} />
              <Route path="invoice" element={<Invoice />} />
              <Route path="mapper" element={<Mapper />} />
              <Route path="hygiene" element={<Hygiene />} />
              <Route path="rightsizing"    element={<Rightsizing />} />
              <Route path="aggregator"    element={<Aggregator />} />
              <Route path="organizations" element={<Organizations />} />
              <Route path="services/ec2"    element={<EC2 />} />
              <Route path="services/rds"    element={<RDS />} />
              <Route path="services/s3"     element={<S3 />} />
              <Route path="services/others" element={<Others />} />
              <Route path="billing/overview" element={<BillingOverview />} />
              <Route path="settings"      element={<Settings />} />
            </Route>
          </Routes>
        </CredentialsGate>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
