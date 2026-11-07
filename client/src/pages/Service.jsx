import React from 'react';
import { FileText } from 'lucide-react';

const Service = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-6">
      <div className="max-w-3xl w-full bg-white p-10 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-3 mb-6">
          <FileText className="w-8 h-8 text-black" />
          <h1 className="text-3xl font-bold text-slate-900">Terms of Service</h1>
        </div>
        
        <div className="prose text-slate-600">
          <p className="mb-4">Last updated: {new Date().toLocaleDateString()}</p>
          
          <h2 className="text-xl font-bold text-slate-800 mt-6 mb-3">1. Acceptance of Terms</h2>
          <p className="mb-4">By accessing and using Nexus, you accept and agree to be bound by the terms and provision of this agreement.</p>
          
          <h2 className="text-xl font-bold text-slate-800 mt-6 mb-3">2. Description of Service</h2>
          <p className="mb-4">Nexus provides market intelligence tools and social media integration services, allowing users to schedule and publish content to third-party platforms.</p>
          
          <h2 className="text-xl font-bold text-slate-800 mt-6 mb-3">3. User Conduct</h2>
          <p className="mb-4">You agree to use the service only for lawful purposes. You agree not to take any action that might compromise the security of the service, render the service inaccessible to others, or otherwise cause damage to the service or the Content.</p>
          
          <h2 className="text-xl font-bold text-slate-800 mt-6 mb-3">4. Third-Party Services</h2>
          <p className="mb-4">Our Service may contain links to or integrations with third-party web sites or services (e.g., X, LinkedIn) that are not owned or controlled by us. We assume no responsibility for the content, privacy policies, or practices of any third party web sites or services.</p>
          
          <h2 className="text-xl font-bold text-slate-800 mt-6 mb-3">5. Termination</h2>
          <p className="mb-4">We may terminate or suspend access to our Service immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.</p>
        </div>
        
        <div className="mt-10 border-t border-slate-100 pt-6 text-center">
          <a href="/" className="text-[#0A66C2] hover:underline font-medium">Return to Home</a>
        </div>
      </div>
    </div>
  );
};

export default Service;
