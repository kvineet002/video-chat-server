import React from 'react';
import { Radio, Waves, Users, Music4, Sparkles } from 'lucide-react';

const InfoCard = () => {
  // The 2Peer brand color
  const lavenderAccent = "#E9D6FB";

  return (
    // Outer container provided in prompt
    <div className=" py-4 flex items-center justify-center bg-white">
      
      {/* --- CARD START --- */}
      <div className=" w-full rounded-3xl overflow-hidden bg-slate-900/90 border border-white/10 shadow-2xl">
        
        {/* Subtle background glow effect */}
        <div className="absolute -top-20 -left-20 h-40 w-40 rounded-full bg-[#E9D6FB] opacity-20 blur-[60px] pointer-events-none"></div>
        <div className="absolute -bottom-20 -right-20 h-40 w-40 rounded-full bg-indigo-600 opacity-20 blur-[60px] pointer-events-none"></div>

        <div className="p-6 relative z-10">
          
          {/* Header Section with glowing icon */}
          <div className="flex items-start gap-4 mb-8">
            <div className="relative group">
                <div className={`absolute inset-0 bg-[${lavenderAccent}] rounded-2xl blur-md opacity-40 group-hover:opacity-60 transition-opacity duration-500`}></div>
                <div className="relative bg-slate-800/80 border border-slate-700/50 p-3.5 rounded-2xl flex items-center justify-center">
                    <Radio className={`h-7 w-7 text-[${lavenderAccent}] drop-shadow-[0_0_10px_rgba(233,214,251,0.6)]`} />
                </div>
            </div>
            <div>
              <h2 className="text-white font-bold text-xl flex items-center gap-2">
                2Peer Sync <Sparkles className="h-4 w-4 text-yellow-200 opacity-50" />
              </h2>
              <p className="text-slate-400 text-sm leading-tight mt-1">
                Listen in perfect harmony across devices.
              </p>
            </div>
          </div>

          {/* Feature List */}
          <div className="space-y-6">
            
            {/* Feature 1 */}
            <div className="flex gap-4">
              <div className="mt-1 bg-slate-800/50 h-8 w-8 rounded-full flex items-center justify-center border border-slate-700/30 flex-shrink-0">
                  <Waves className="h-4 w-4 text-slate-300" />
              </div>
              <div>
                <h3 className="text-slate-200 font-semibold text-sm">Ultra-Low Latency</h3>
                <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                  Audio stays perfectly synchronized between you and your peer, as if you're sharing earbuds.
                </p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="flex gap-4">
               <div className="mt-1 bg-slate-800/50 h-8 w-8 rounded-full flex items-center justify-center border border-slate-700/30 flex-shrink-0">
                  <Users className="h-4 w-4 text-slate-300" />
              </div>
              <div>
                <h3 className="text-slate-200 font-semibold text-sm">Private Duo Sessions</h3>
                <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                  Secure, invite-only rooms designed specifically for two simultaneous listeners.
                </p>
              </div>
            </div>

             {/* Feature 3 */}
             <div className="flex gap-4">
               <div className="mt-1 bg-slate-800/50 h-8 w-8 rounded-full flex items-center justify-center border border-slate-700/30 flex-shrink-0">
                  <Music4 className="h-4 w-4 text-slate-300" />
              </div>
              <div>
                <h3 className="text-slate-200 font-semibold text-sm">Collaborative Control</h3>
                <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                  Either peer can pause, play, skip, or scrub the track for both users instantly.
                </p>
              </div>
            </div>

          </div>
        </div>
        
        {/* Bottom decorative border */}
        <div className={`h-1 w-full bg-gradient-to-r from-transparent via-[${lavenderAccent}] to-transparent opacity-20`}></div>
      </div>
      {/* --- CARD END --- */}

    </div>
  );
};

export default InfoCard;