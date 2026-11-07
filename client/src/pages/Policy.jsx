import React from 'react';
import { ShieldCheck } from 'lucide-react';

const Policy = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-6">
      <div className="max-w-3xl w-full bg-white p-10 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-3 mb-6">
          <ShieldCheck className="w-8 h-8 text-black" />
          <h1 className="text-3xl font-bold text-slate-900">Privacy Policy</h1>
        </div>
        
        <div className="prose text-slate-600">
          <p className="mb-4">Last updated: {new Date().toLocaleDateString()}</p>
          
          <h2 className="text-xl font-bold text-slate-800 mt-6 mb-3">1. Information We Collect</h2>
          <p className="mb-4">We collect information you provide directly to us when you create an account or connect third-party services like LinkedIn and X (Twitter). This includes your name, email address, profile pictures, and access tokens for connected platforms.</p>
          
          <h2 className="text-xl font-bold text-slate-800 mt-6 mb-3">2. How We Use Your Information</h2>
          <p className="mb-4">We use the information we collect to provide, maintain, and improve our services, authenticate your identity, and post to your connected social media accounts strictly on your behalf when authorized.</p>
          
          <h2 className="text-xl font-bold text-slate-800 mt-6 mb-3">3. Third-Party Access</h2>
          <p className="mb-4">When you connect external accounts (such as X or LinkedIn), we store the necessary authentication tokens to perform actions you request. We do not sell or share these credentials with anyone else.</p>
          
          <h2 className="text-xl font-bold text-slate-800 mt-6 mb-3">4. Your Rights</h2>
          <p className="mb-4">You may disconnect your social accounts at any time from your profile page, which will revoke our access and remove the corresponding tokens from our database.</p>
          
          <h2 className="text-xl font-bold text-slate-800 mt-6 mb-3">5. Contact Us</h2>
          <p className="mb-4">If you have any questions about this Privacy Policy, please contact us.</p>
        </div>
        
        <div className="mt-10 border-t border-slate-100 pt-6 text-center">
          <a href="/" className="text-[#0A66C2] hover:underline font-medium">Return to Home</a>
        </div>
      </div>
    </div>
  );
};

export default Policy;
