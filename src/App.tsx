/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';
import { analyzeFoodImage } from './services/aiService';
import { 
  Camera, 
  Upload, 
  History, 
  LogOut, 
  Loader2, 
  Utensils, 
  Flame, 
  Beef, 
  Droplets, 
  Wheat,
  ChevronRight,
  User,
  Plus
} from 'lucide-react';

console.log('Loaded Nutrition-Analyzer-1- app from src/App.tsx');
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

// --- Types ---
interface AnalysisResult {
  id?: string;
  user_id?: string;
  detected_foods: string[];
  calories: number;
  protein: number;
  fats: number;
  carbs: number;
  image_url: string;
  created_at?: string;
  recommendations?: string[];
}

// --- Main App Component ---
export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('auth session on load', session);
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('auth state changed', _event, session);
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {!session ? <AuthScreen /> : <Dashboard session={session} />}
    </div>
  );
}

// --- Auth Component ---
function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [justSignedUp, setJustSignedUp] = useState(false);

  const handleAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;

        if (data?.session) {
          setSuccess('Signup successful. You are now signed in.');
          setJustSignedUp(false);
        } else {
          setSuccess('Signup successful. Please sign in with your new account.');
          setIsLogin(true);
          setJustSignedUp(true);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md glass-card rounded-3xl p-8"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mb-4">
            <Utensils className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">NutriScan AI</h1>
          <p className="text-slate-500 mt-2">Your personal nutrition assistant</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">{error}</p>
          )}
          {success && (
            <p className="text-emerald-700 text-sm bg-emerald-50 p-3 rounded-lg">{success}</p>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLogin ? 'Sign In' : 'Sign Up')}
          </button>
        </form>

        <div className="mt-6 text-center">
          {justSignedUp && (
            <button
              onClick={() => setJustSignedUp(false)}
              className="mb-4 inline-flex items-center justify-center px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition"
            >
              Continue to Sign In
            </button>
          )}
          <button 
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
              setSuccess(null);
              setJustSignedUp(false);
            }}
            className="text-emerald-600 font-medium hover:underline"
          >
            {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// --- Dashboard Component ---
function Dashboard({ session }: { session: any }) {
  const [view, setView] = useState<'upload' | 'history'>('upload');
  const [analyzing, setAnalyzing] = useState(false);
  const [history, setHistory] = useState<AnalysisResult[]>([]);
  const [currentResult, setCurrentResult] = useState<AnalysisResult | null>(null);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<AnalysisResult | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Image compression helper
  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const img = new Image();
      
      img.onload = () => {
        // Resize to max 800px width/height while maintaining aspect ratio
        const maxSize = 800;
        let { width, height } = img;
        
        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() });
            resolve(compressedFile);
          } else {
            resolve(file); // Fallback to original
          }
        }, 'image/jpeg', 0.8); // 80% quality
      };
      
      img.src = URL.createObjectURL(file);
    });
  };

  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Unable to read file as data URL'));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    if (!session?.user?.id) {
      setHistoryError('No authenticated user session available.');
      return;
    }

    console.log('Fetching history for user:', session.user.id);
    const { data, error } = await supabase
      .from('food_analysis')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    console.log('History fetch result:', { data, error });
    if (data) {
      setHistory(data);
      setHistoryError(null);
    }
    if (error) {
      console.error('History fetch error:', error);
      setHistory([]);
      setHistoryError(error.message);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalyzing(true);
    setCurrentResult(null);

    try {
      // 1. Compress image for faster upload and analysis
      const compressedFile = await compressImage(file);

      // 2. Convert to Base64 for Gemini
      const base64data = await readFileAsDataURL(compressedFile);

      // 3. Analyze with AI
      const analysis = await analyzeFoodImage(base64data);
      
      const localImageUrl = URL.createObjectURL(compressedFile);
      const finalResult: AnalysisResult = {
        ...analysis,
        image_url: localImageUrl,
        user_id: session.user.id
      };

      setCurrentResult(finalResult);
      setAnalyzing(false);

      // 4. Upload image and save history in the background
      (async () => {
        try {
          const fileExt = compressedFile.name.split('.').pop();
          const fileName = `${Math.random()}.${fileExt}`;
          const filePath = `${session.user.id}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('food-images')
            .upload(filePath, compressedFile);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('food-images')
            .getPublicUrl(filePath);

          const resultToSave = {
            ...analysis,
            image_url: publicUrl,
            user_id: session.user.id
          };

          const { data: savedData, error: saveError } = await supabase
            .from('food_analysis')
            .insert([resultToSave])
            .select()
            .single();

          if (saveError) {
            console.error('DB save error:', saveError);
            setSaveError(saveError.message);
          } else {
            console.log('Saved to DB:', savedData);
            setCurrentResult(savedData || resultToSave);
            setSaveError(null);
            fetchHistory();
          }
        } catch (backgroundError) {
          console.error('Background save error:', backgroundError);
        }
      })();
    } catch (err: any) {
      console.error(err);
      alert('Error analyzing food: ' + err.message);
      setAnalyzing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <header className="flex items-center justify-between mb-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center">
            <Utensils className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">NutriScan</h1>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => supabase.auth.signOut()}
            className="p-2 text-slate-500 hover:text-red-500 transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 bg-slate-200/50 p-1 rounded-2xl w-fit">
        <button 
          onClick={() => setView('upload')}
          className={cn(
            "px-6 py-2 rounded-xl font-medium transition-all flex items-center gap-2",
            view === 'upload' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
          )}
        >
          <Plus className="w-4 h-4" /> Analyze
        </button>
        <button 
          onClick={() => setView('history')}
          className={cn(
            "px-6 py-2 rounded-xl font-medium transition-all flex items-center gap-2",
            view === 'history' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
          )}
        >
          <History className="w-4 h-4" /> History
        </button>
      </div>

      <AnimatePresence mode="wait">
        {view === 'upload' ? (
          <motion.div 
            key="upload"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-8"
          >
            {/* Upload Area */}
            {!currentResult && !analyzing && (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 rounded-3xl p-12 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/50 transition-all group"
              >
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6 group-hover:bg-emerald-100 transition-colors">
                  <Camera className="w-10 h-10 text-slate-400 group-hover:text-emerald-600" />
                </div>
                <h2 className="text-xl font-semibold text-slate-900 mb-2">Upload Food Photo</h2>
                <p className="text-slate-500 text-center max-w-xs">
                  Snap a picture of your meal to get instant nutritional breakdown
                </p>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden" 
                  accept="image/*"
                />
              </div>
            )}

            {/* Analyzing State */}
            {!currentResult && analyzing && (
              <div className="border-2 border-dashed border-emerald-300 rounded-3xl p-12 flex flex-col items-center justify-center bg-emerald-50/50 transition-all">
                <div className="relative mb-6">
                  <div className="w-24 h-24 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
                  <Utensils className="w-10 h-10 text-emerald-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <h2 className="text-xl font-semibold text-slate-900 mb-2">Analyzing your meal...</h2>
                <p className="text-slate-500 text-center max-w-xs">
                  Please wait while Gemini AI identifies the ingredients and estimates macros.
                </p>
              </div>
            )}

            {/* Result Display */}
            {currentResult && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-card rounded-3xl overflow-hidden"
              >
                <div className="grid md:grid-cols-2 gap-0">
                  <div className="h-64 md:h-auto relative">
                    <img 
                      src={currentResult.image_url} 
                      alt="Analyzed food" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="p-8">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-2xl font-bold text-slate-900">Analysis Result</h2>
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-semibold">
                        {currentResult.calories} kcal
                      </span>
                    </div>

                    <div className="space-y-6">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Detected Foods</h4>
                        <div className="flex flex-wrap gap-2">
                          {currentResult.detected_foods.map((food, i) => (
                            <span key={i} className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-sm">
                              {food}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <MacroCard icon={<Beef className="w-4 h-4" />} label="Protein" value={`${currentResult.protein}g`} color="bg-blue-50 text-blue-600" />
                        <MacroCard icon={<Droplets className="w-4 h-4" />} label="Fats" value={`${currentResult.fats}g`} color="bg-amber-50 text-amber-600" />
                        <MacroCard icon={<Wheat className="w-4 h-4" />} label="Carbs" value={`${currentResult.carbs}g`} color="bg-orange-50 text-orange-600" />
                      </div>

                      {currentResult.recommendations && currentResult.recommendations.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Recommendations</h4>
                          <ul className="space-y-2">
                            {currentResult.recommendations.map((rec, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-2 flex-shrink-0" />
                                {rec}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <button 
                        onClick={() => setCurrentResult(null)}
                        className="w-full mt-4 py-3 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        Analyze Another
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        ) : (
          <motion.div 
            key="history"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="grid gap-4"
          >
            {historyError && (
              <div className="rounded-3xl border border-red-200 bg-red-50 text-red-700 p-4 text-sm">
                Unable to load history: {historyError}
              </div>
            )}
            {saveError && (
              <div className="rounded-3xl border border-amber-200 bg-amber-50 text-amber-700 p-4 text-sm">
                Warning: history save failed - {saveError}
              </div>
            )}
            {history.length === 0 ? (
              <div className="text-center py-20 text-slate-500">
                <History className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>No analysis history yet</p>
              </div>
            ) : (
              <>
                {history.map((item) => (
                  <div 
                    key={item.id} 
                    onClick={() => setSelectedHistoryItem(item)}
                    className="glass-card rounded-2xl p-4 flex items-center gap-4 hover:shadow-md hover:cursor-pointer hover:bg-slate-50 transition-all"
                  >
                    <img 
                      src={item.image_url} 
                      className="w-16 h-16 rounded-xl object-cover" 
                      alt="Food"
                      referrerPolicy="no-referrer"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-slate-900 truncate">
                        {item.detected_foods.join(', ')}
                      </h4>
                      <p className="text-sm text-slate-500">
                        {new Date(item.created_at!).toLocaleDateString()} • {item.calories} kcal
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <div className="text-center px-2">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">P</p>
                        <p className="text-sm font-bold text-blue-600">{item.protein}g</p>
                      </div>
                      <div className="text-center px-2">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">F</p>
                        <p className="text-sm font-bold text-amber-600">{item.fats}g</p>
                      </div>
                      <div className="text-center px-2">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">C</p>
                        <p className="text-sm font-bold text-orange-600">{item.carbs}g</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </div>
                ))}

                {/* History Detail Modal */}
                <AnimatePresence>
                  {selectedHistoryItem && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setSelectedHistoryItem(null)}
                      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
                    >
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        onClick={(e) => e.stopPropagation()}
                        className="glass-card rounded-3xl overflow-hidden max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                      >
                        <div className="grid md:grid-cols-2 gap-0">
                          <div className="h-64 md:h-auto relative">
                            <img 
                              src={selectedHistoryItem.image_url} 
                              alt="Analyzed food" 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <div className="p-8">
                            <div className="flex items-center justify-between mb-6">
                              <h2 className="text-2xl font-bold text-slate-900">Analysis Details</h2>
                              <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-semibold">
                                {selectedHistoryItem.calories} kcal
                              </span>
                            </div>

                            <div className="space-y-6">
                              <div>
                                <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Detected Foods</h4>
                                <div className="flex flex-wrap gap-2">
                                  {selectedHistoryItem.detected_foods.map((food, i) => (
                                    <span key={i} className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-sm">
                                      {food}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              <div className="grid grid-cols-3 gap-4">
                                <MacroCard icon={<Beef className="w-4 h-4" />} label="Protein" value={`${selectedHistoryItem.protein}g`} color="bg-blue-50 text-blue-600" />
                                <MacroCard icon={<Droplets className="w-4 h-4" />} label="Fats" value={`${selectedHistoryItem.fats}g`} color="bg-amber-50 text-amber-600" />
                                <MacroCard icon={<Wheat className="w-4 h-4" />} label="Carbs" value={`${selectedHistoryItem.carbs}g`} color="bg-orange-50 text-orange-600" />
                              </div>

                              {selectedHistoryItem.recommendations && selectedHistoryItem.recommendations.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Recommendations</h4>
                                  <ul className="space-y-2">
                                    {selectedHistoryItem.recommendations.map((rec, i) => (
                                      <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-2 flex-shrink-0" />
                                        {rec}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              <button 
                                onClick={() => setSelectedHistoryItem(null)}
                                className="w-full py-3 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                              >
                                Close
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MacroCard({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: string, color: string }) {
  return (
    <div className={cn("p-3 rounded-2xl flex flex-col items-center text-center", color)}>
      <div className="mb-1">{icon}</div>
      <p className="text-[10px] font-bold uppercase opacity-70">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}
