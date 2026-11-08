import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import ThemeProvider from './components/ThemeProvider';
import Toaster from './components/Toaster';
import AppLayout from './components/layout/AppLayout';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import ProjectDetails from './pages/ProjectDetails';
import TextFormatterPage from './pages/compose/TextFormatterPage';
import Posts from './pages/Posts';
import { Policy, Service } from './pages/Legal';

function App() {
  return (
    <ThemeProvider>
      {/* Respect the OS "reduce motion" setting everywhere */}
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <Toaster>
            <Routes>
              <Route path="/" element={<Auth />} />
              <Route path="/policy" element={<Policy />} />
              <Route path="/service" element={<Service />} />
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/projects/:id" element={<ProjectDetails />} />
                <Route path="/compose" element={<TextFormatterPage />} />
                <Route path="/posts" element={<Posts />} />
              </Route>
            </Routes>
          </Toaster>
        </BrowserRouter>
      </MotionConfig>
    </ThemeProvider>
  );
}

export default App;
