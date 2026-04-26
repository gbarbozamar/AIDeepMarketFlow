import React, { useState, useRef, useEffect } from 'react';
import { get, set, clear } from 'idb-keyval';
import { 
  Upload, 
  Sparkles, 
  Image as ImageIcon, 
  Palette, 
  User, 
  Trees, 
  Type, 
  Loader2,
  ChevronRight,
  Download,
  AlertCircle,
  RefreshCw,
  FileText,
  Lightbulb,
  CheckCircle2,
  Edit3,
  Save,
  Library,
  X,
  Plus,
  LayoutDashboard,
  Target,
  Zap,
  Archive,
  Menu,
  Database
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  analyzeImage, 
  generateMarketingImage, 
  analyzeProductDocument, 
  generateSuggestedPrompts,
  editMarketingImage,
  BrandProfile, 
  ProductKnowledge 
} from './lib/gemini';

/**
 * MarketFlow AI Studio
 * Optimized for focused workflows with persistence and dynamic staging.
 */

type Stage = 'source' | 'strategy' | 'lab' | 'library';

const App: React.FC = () => {
  // Navigation State
  const [currentStage, setCurrentStage] = useState<Stage>('source');
  
  // Data States
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null);
  const [brandProfile, setBrandProfile] = useState<BrandProfile | null>(null);
  const [productKnowledge, setProductKnowledge] = useState<ProductKnowledge | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [prompt, setPrompt] = useState('');
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [userLogos, setUserLogos] = useState<{ id: string; name: string; data: string }[]>([]);
  const [libraryImages, setLibraryImages] = useState<string[]>([]);
  
  // UI States
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAnalyzingDocs, setIsAnalyzingDocs] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingImage, setEditingImage] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [selectedLogo, setSelectedLogo] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-2.5-flash-image');
  const [hasCustomKey, setHasCustomKey] = useState<boolean>(false);

  const GOOGLE_IMAGE_MODELS = [
    { id: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash Image', description: 'Fast, general purpose generation and editing.', requiresKey: false },
    { id: 'gemini-3.1-flash-image-preview', name: 'Gemini 3.1 Flash Image', description: 'Improved detail and complex prompt adherence. Requires own API key.', requiresKey: true },
    { id: 'gemini-3-pro-image-preview', name: 'Gemini 3 Pro Image', description: 'Superior cinematic quality. Requires own API key.', requiresKey: true },
    { id: 'imagen-3.0-generate-001', name: 'Imagen 3 High Quality', description: 'Photorealistic results with high adherence to prompts. Requires own API key.', requiresKey: true },
    { id: 'imagen-3.0-fast-generate-001', name: 'Imagen 3 Fast', description: 'Quick generation with good quality. Requires own API key.', requiresKey: true },
    { id: 'imagen-4.0-generate-001', name: 'Imagen 4 Pro (Next-Gen)', description: 'Next-gen photorealism and flexibility. Requires own API key.', requiresKey: true },
  ];

  // Persistence: Load on Mount
  useEffect(() => {
    const initStorage = async () => {
      console.log('MarketFlow: Initializing App Context (IndexedDB)');
      try {
        const [refs, profile, knowledge, gen, logos, lib] = await Promise.all([
          get('mf_refs'),
          get('mf_profile'),
          get('mf_knowledge'),
          get('mf_gen'),
          get('mf_logos'),
          get('mf_lib')
        ]);

        if (refs) setReferenceImages(refs);
        if (profile) setBrandProfile(profile);
        if (knowledge) setProductKnowledge(knowledge);
        if (gen) setGeneratedImages(gen);
        if (logos) setUserLogos(logos);
        if (lib) setLibraryImages(lib);

        const savedStage = localStorage.getItem('mf_stage');
        if (savedStage) setCurrentStage(savedStage as Stage);

        const savedModel = localStorage.getItem('mf_model');
        if (savedModel) setSelectedModel(savedModel);

        // Check for custom key
        if ((window as any).aistudio?.hasSelectedApiKey) {
          const hasKey = await (window as any).aistudio.hasSelectedApiKey();
          setHasCustomKey(hasKey);
        }
      } catch (err) {
        console.error('MarketFlow: Persistence recovery failed', err);
      }
    };
    initStorage();
  }, []);

  // Persistence: Sync on Change
  useEffect(() => {
    const sync = async () => {
      try {
        await Promise.all([
          set('mf_refs', referenceImages),
          set('mf_profile', brandProfile),
          set('mf_knowledge', productKnowledge),
          set('mf_gen', generatedImages),
          set('mf_logos', userLogos),
          set('mf_lib', libraryImages)
        ]);
        localStorage.setItem('mf_stage', currentStage);
        localStorage.setItem('mf_model', selectedModel);
      } catch (e) {
        console.error("Storage sync failed", e);
      }
    };
    sync();
  }, [referenceImages, brandProfile, productKnowledge, generatedImages, userLogos, libraryImages, currentStage, selectedModel]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleOpenKeySelector = async () => {
    if ((window as any).aistudio?.openSelectKey) {
      await (window as any).aistudio.openSelectKey();
      setHasCustomKey(true);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    let processedCount = 0;
    const newBase64s: string[] = [];

    files.forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        newBase64s.push(base64);
        processedCount++;

        if (processedCount === files.length) {
          setReferenceImages(prev => {
            const updated = [...prev, ...newBase64s];
            performCompositeAnalysis(updated);
            return updated;
          });
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsAnalyzingDocs(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64 = event.target?.result as string;
        const knowledge = await analyzeProductDocument(base64, file.type);
        setProductKnowledge(knowledge);
        if (brandProfile) {
          const newSuggestions = await generateSuggestedPrompts(brandProfile, knowledge);
          setSuggestions(newSuggestions);
        }
      } catch (err) { setError("Failed to process document."); } finally { setIsAnalyzingDocs(false); }
    };
    reader.readAsDataURL(file);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      const newLogo = { id: `logo-${Date.now()}`, name: file.name.split('.')[0], data: base64 };
      setUserLogos(prev => [...prev, newLogo]);
      setSelectedLogo(newLogo.id);
    };
    reader.readAsDataURL(file);
  };

  const performCompositeAnalysis = async (images: string[]) => {
    if (images.length === 0) return;
    setIsAnalyzing(true);
    try {
      const profile = await analyzeImage(images);
      setBrandProfile(profile);
      if (productKnowledge) {
        const newSuggestions = await generateSuggestedPrompts(profile, productKnowledge);
        setSuggestions(newSuggestions);
      }
    } catch (err) { 
      console.error(err);
      setError('Composite analysis failed.'); 
    } finally { 
      setIsAnalyzing(false); 
    }
  };

  const handleGenerate = async () => {
    if (!brandProfile || !prompt) return;
    setIsGenerating(true);
    try {
      const newImage = await generateMarketingImage(prompt, brandProfile, selectedModel);
      setGeneratedImages(prev => [newImage, ...prev]);
    } catch (err) { setError('Generation failed.'); } finally { setIsGenerating(false); }
  };

  const handleEdit = async () => {
    if (!editingImage || !brandProfile) return;
    setIsEditing(true);
    try {
      const activeLogo = userLogos.find(l => l.id === selectedLogo);
      const enhancedPrompt = selectedLogo ? `${editPrompt}. Use the provided logo.` : editPrompt;
      const updatedImage = await editMarketingImage(editingImage, enhancedPrompt, brandProfile, selectedModel, activeLogo?.data);
      setEditingImage(updatedImage);
      setEditPrompt('');
    } catch (err) { setError('Edit failed.'); } finally { setIsEditing(false); }
  };

  const handleReset = async () => {
    if (!confirm("This will delete all your brand DNA, product strategy, and generated assets. Continue?")) return;
    await clear();
    localStorage.clear();
    setReferenceImages([]);
    setBrandProfile(null);
    setProductKnowledge(null);
    setGeneratedImages([]);
    setUserLogos([]);
    setLibraryImages([]);
    setSuggestions([]);
    setPrompt('');
    setError(null);
    window.location.reload();
  };

  const navItems = [
    { id: 'source', icon: LayoutDashboard, label: 'Analysis', desc: 'Brand DNA' },
    { id: 'strategy', icon: Target, label: 'Strategy', desc: 'Knowledge' },
    { id: 'lab', icon: Zap, label: 'Generator', desc: 'Artifacts' },
    { id: 'library', icon: Archive, label: 'Library', desc: 'Archives' },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900 flex h-screen overflow-auto">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col z-50">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg">
              <Sparkles size={20} />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-tight leading-none">MarketFlow</h1>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">AI Studio v2.0</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentStage(item.id as Stage)}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all group ${
                currentStage === item.id 
                  ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/10' 
                  : 'text-slate-400 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <item.icon size={20} className={currentStage === item.id ? 'text-blue-400' : 'group-hover:text-blue-600'} />
              <div className="text-left">
                <div className="text-[11px] font-black uppercase tracking-widest leading-none mb-1">{item.label}</div>
                <div className={`text-[9px] font-bold ${currentStage === item.id ? 'text-slate-400' : 'text-slate-300'}`}>{item.desc}</div>
              </div>
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-slate-100 space-y-4">
          <button 
            onClick={handleReset}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50 transition-all border border-dashed border-red-200"
          >
            <RefreshCw size={12} /> Wipe Storage
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-10 sticky top-0 z-40">
          <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">
            {navItems.find(n => n.id === currentStage)?.label} Pipeline
          </h2>
          <div className="flex items-center gap-6">
            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase flex items-center gap-2 animate-bounce">
                <AlertCircle size={14} /> {error}
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)]" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Engine Stable</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto custom-scrollbar p-10">
          <AnimatePresence mode="wait">
            {currentStage === 'source' && (
              <motion.div 
                key="source"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-4xl mx-auto space-y-8"
              >
                <div className="flex items-center justify-between bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
                    <ImageIcon size={200} />
                  </div>
                  <div className="relative z-10 w-2/3">
                    <h3 className="text-3xl font-black tracking-tight mb-4">Ingest Vision</h3>
                    <p className="text-slate-500 font-medium leading-relaxed mb-6">Upload reference images to extract visual DNA including style, lighting, and palette for consistent generations.</p>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="px-8 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-slate-900/20 active:scale-95 transition-all flex items-center gap-3"
                    >
                      <Upload size={16} /> Select Content
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleImageUpload} multiple className="hidden" accept="image/*" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-6">
                  {referenceImages.map((img, idx) => (
                    <motion.div 
                      key={idx}
                      whileHover={{ scale: 1.02 }}
                      className={`relative aspect-square rounded-[32px] overflow-hidden border-4 shadow-lg cursor-pointer ${activeImageIndex === idx ? 'border-blue-600' : 'border-white'}`}
                      onClick={() => setActiveImageIndex(idx)}
                    >
                      <img src={img} className="w-full h-full object-cover" />
                      {isAnalyzing && (
                        <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] flex items-center justify-center">
                          <Loader2 className="animate-spin text-blue-600" size={24} />
                        </div>
                      )}
                    </motion.div>
                  ))}
                  {referenceImages.length > 0 && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      onClick={() => performCompositeAnalysis(referenceImages)}
                      disabled={isAnalyzing}
                      className="aspect-square rounded-[32px] border-4 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center gap-3 group hover:border-blue-400 hover:bg-blue-50 transition-all disabled:opacity-50"
                    >
                      {isAnalyzing ? (
                        <Loader2 className="animate-spin text-blue-600" size={32} />
                      ) : (
                        <>
                          <RefreshCw size={32} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-blue-600">Sync Master DNA</span>
                        </>
                      )}
                    </motion.button>
                  )}
                </div>

                {brandProfile && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-xl grid grid-cols-3 gap-12">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase text-blue-600 tracking-widest">
                        <Palette size={16} /> Artistic Style
                      </div>
                      <p className="text-sm font-bold text-slate-800 leading-relaxed">{brandProfile.style}</p>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase text-blue-600 tracking-widest">
                        <Trees size={16} /> Environment
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {brandProfile.landscapeElements?.map(e => (
                          <span key={e} className="px-3 py-1 bg-slate-50 border border-slate-100 rounded-full text-[10px] font-bold text-slate-600 capitalize">{e}</span>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase text-blue-600 tracking-widest">
                        <Archive size={16} /> Color Profile
                      </div>
                      <div className="flex gap-2">
                        {brandProfile.colorPalette?.map(c => (
                          <div key={c} className="w-8 h-8 rounded-xl shadow-inner border border-white" style={{ backgroundColor: c }} />
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}

            {currentStage === 'strategy' && (
              <motion.div 
                key="strategy"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-4xl mx-auto space-y-10"
              >
                <div className="bg-white p-10 rounded-[40px] border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-center mb-8">
                    <div>
                      <h3 className="text-2xl font-black mb-2 tracking-tight">Intelligence Brief</h3>
                      <p className="text-slate-400 text-sm font-medium">Upload PDF/Txt briefs to train the engine on your product benefits.</p>
                    </div>
                    <button 
                      onClick={() => docInputRef.current?.click()}
                      className="px-6 py-3 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-600/20"
                    >
                      Upload Docs
                    </button>
                    <input type="file" ref={docInputRef} onChange={handleDocUpload} className="hidden" accept=".pdf,.txt" />
                  </div>

                  {isAnalyzingDocs && (
                    <div className="py-20 flex flex-col items-center justify-center animate-pulse">
                      <Loader2 className="animate-spin text-blue-600 mb-4" size={40} />
                      <p className="text-[10px] font-black uppercase tracking-widest">Extracting Product IQ...</p>
                    </div>
                  )}

                  {productKnowledge && !isAnalyzingDocs && (
                    <div className="grid grid-cols-2 gap-8">
                      <div className="p-8 bg-slate-50 border border-slate-200 rounded-[32px] space-y-4">
                        <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Product / Service</div>
                        <div className="text-xl font-black text-slate-900">{productKnowledge.name}</div>
                        <div className="flex items-center gap-2 py-1 px-3 bg-white w-fit rounded-full border border-slate-100 shadow-sm">
                          <Target size={12} className="text-slate-400" />
                          <span className="text-[10px] font-black uppercase text-slate-500">{productKnowledge.targetAudience}</span>
                        </div>
                      </div>
                      <div className="p-8 bg-slate-50 border border-slate-200 rounded-[32px] space-y-4">
                        <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Value Hooks</div>
                        <div className="space-y-2">
                          {productKnowledge.keyFeatures?.map((f, i) => (
                            <div key={i} className="flex items-center gap-3 text-xs font-bold text-slate-700">
                              <CheckCircle2 size={14} className="text-green-500" /> {f}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {suggestions.length > 0 && (
                  <div className="grid grid-cols-2 gap-4">
                    {suggestions.map((s, i) => (
                      <button 
                        key={i}
                        onClick={() => { setPrompt(s); setCurrentStage('lab'); }}
                        className="p-6 bg-white border-2 border-slate-100 hover:border-blue-600 rounded-[32px] text-left group transition-all"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                            <Lightbulb size={16} className="text-slate-400 group-hover:text-blue-600" />
                          </div>
                          <ChevronRight size={16} className="text-slate-200 group-hover:text-blue-600" />
                        </div>
                        <p className="text-xs font-bold text-slate-800 leading-relaxed italic">{s}</p>
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {currentStage === 'lab' && (
              <motion.div 
                key="lab"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-5xl mx-auto space-y-12"
              >
                <div className="flex gap-8">
                  <div className="flex-1 space-y-6">
                    <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-6">
                      <div className="flex items-center gap-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <Sparkles size={16} /> Asset Generator
                      </div>

                      {/* Model Selection */}
                      <div className="pt-2 border-t border-slate-100 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                          <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Select Model</div>
                          {!hasCustomKey && (
                            <button 
                              onClick={handleOpenKeySelector}
                              className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1 hover:underline underline-offset-4 decoration-2"
                            >
                              <Database size={12} /> Use Own Key
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          {GOOGLE_IMAGE_MODELS.map(m => {
                            const isSelected = selectedModel === m.id;
                            const needsKey = m.requiresKey && !hasCustomKey;
                            
                            return (
                              <button
                                key={m.id}
                                onClick={() => setSelectedModel(m.id)}
                                className={`group relative p-4 rounded-3xl border-2 text-left transition-all ${isSelected ? 'border-blue-600 bg-blue-50/50' : 'border-slate-100 bg-white hover:border-slate-200'} ${needsKey ? 'opacity-80' : ''}`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="text-[11px] font-black text-slate-900 leading-none">{m.name}</div>
                                  {m.requiresKey && (
                                    <div className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-tight ${hasCustomKey ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                                      {hasCustomKey ? 'Key Active' : 'Key Ready'}
                                    </div>
                                  )}
                                </div>
                                <div className="text-[9px] font-bold text-slate-500 mt-2 leading-tight">{m.description}</div>
                                {needsKey && isSelected && (
                                  <div className="mt-2 p-2 bg-amber-50 rounded-xl border border-amber-100 text-[8px] font-bold text-amber-700 leading-normal animate-pulse">
                                    Warning: This model requires a custom API key. Click "Use Own Key" above to enable.
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex flex-col gap-4 pt-4 border-t border-slate-100">
                        <textarea 
                          value={prompt}
                          onChange={(e) => setPrompt(e.target.value)}
                          placeholder="Input creative concept..."
                          className="w-full p-6 rounded-3xl bg-slate-50/50 border-2 border-slate-100 text-sm leading-relaxed outline-none focus:bg-white focus:border-blue-600/50 transition-all font-medium resize-none shadow-inner min-h-[140px]"
                        />
                        <button 
                          disabled={isGenerating || !prompt || !brandProfile}
                          onClick={handleGenerate}
                          className="w-full py-5 rounded-[24px] bg-slate-900 text-white text-[11px] font-black uppercase tracking-[0.3em] hover:bg-black transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95 disabled:opacity-20"
                        >
                          {isGenerating ? <><Loader2 size={18} className="animate-spin" /> Cooking...</> : 
                           !brandProfile ? <><AlertCircle size={18} /> DNA Missing</> :
                           <><Zap size={18} /> Ignite Pipeline</>}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="w-80 space-y-6">
                    <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Status Log</h4>
                      <div className="space-y-6">
                        <div className="flex gap-4">
                          <div className={`w-1 h-8 rounded-full ${brandProfile ? 'bg-green-500' : 'bg-slate-200'}`} />
                          <div>
                            <div className="text-[10px] font-black uppercase text-slate-800">Vision DNA</div>
                            <div className="text-[9px] font-bold text-slate-400">{brandProfile ? 'Sync Success' : 'Missing DNA'}</div>
                          </div>
                        </div>
                        <div className="flex gap-4">
                          <div className={`w-1 h-8 rounded-full ${productKnowledge ? 'bg-green-500' : 'bg-slate-200'}`} />
                          <div>
                            <div className="text-[10px] font-black uppercase text-slate-800">Strategy Kit</div>
                            <div className="text-[9px] font-bold text-slate-400">{productKnowledge ? 'Armed' : 'Disarmed'}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-6">
                  {generatedImages.map((img, idx) => (
                    <motion.div 
                      key={idx}
                      whileHover={{ scale: 1.05 }}
                      className="group relative rounded-[32px] overflow-hidden shadow-2xl border-2 border-white"
                    >
                      <img src={img} className="w-full aspect-square object-cover" />
                      <div className="absolute inset-0 bg-white/95 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-6 gap-3">
                        <button 
                          onClick={() => setEditingImage(img)}
                          className="w-full py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
                        >
                          <Edit3 size={14} /> Open Editor
                        </button>
                        <button 
                          onClick={() => setLibraryImages(prev => [img, ...prev])}
                          className="w-full py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
                        >
                          <Archive size={14} /> Save to Lib
                        </button>
                      </div>
                    </motion.div>
                  ))}
                  {isGenerating && (
                    <div className="aspect-square rounded-[32px] bg-slate-100 animate-pulse border-2 border-dashed border-slate-300 flex items-center justify-center">
                      <Zap size={32} className="text-slate-300 animate-bounce" />
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {currentStage === 'library' && (
              <motion.div 
                key="library"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-6xl mx-auto"
              >
                <div className="flex justify-between items-end mb-12">
                  <div>
                    <h3 className="text-4xl font-black tracking-tight mb-2">Final Vault</h3>
                    <p className="text-slate-400 text-sm font-medium">Archived marketing artifacts, ready for deployment.</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="px-6 py-3 bg-white border border-slate-200 rounded-2xl flex items-center gap-3">
                      <Archive size={16} className="text-slate-400" />
                      <span className="text-xl font-black">{libraryImages.length}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-6">
                  {libraryImages.map((img, idx) => (
                    <motion.div 
                      key={idx}
                      whileHover={{ y: -10 }}
                      className="group relative bg-white p-3 rounded-[32px] border border-slate-200 shadow-lg"
                    >
                      <div className="aspect-square rounded-[24px] overflow-hidden mb-4">
                        <img src={img} className="w-full h-full object-cover shadow-inner" />
                      </div>
                      <div className="flex justify-between items-center px-2 pb-2">
                        <div className="text-[9px] font-black text-slate-300 uppercase">ARTI_PV_{idx+100}</div>
                        <button 
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = img;
                            link.download = `marketflow-artifact-${idx}.png`;
                            link.click();
                          }}
                          className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                        >
                          <Download size={14} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                  {libraryImages.length === 0 && (
                    <div className="col-span-5 h-[400px] flex flex-col items-center justify-center text-slate-200 opacity-30">
                      <Archive size={100} className="mb-6 stroke-[1px]" />
                      <p className="text-xl font-black uppercase tracking-[0.2em]">Vault Empty</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Editor Modal */}
      <AnimatePresence>
        {editingImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-slate-900/60 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white w-full max-w-6xl rounded-[48px] shadow-2xl flex overflow-hidden border border-white/20 h-[85vh]"
            >
              <div className="w-3/5 bg-[#F1F5F9] flex items-center justify-center p-16 relative">
                <div className="relative z-10 w-full aspect-square max-w-[500px] rounded-[32px] shadow-2xl overflow-hidden border-8 border-white ring-1 ring-slate-200">
                  <img src={editingImage} className="w-full h-full object-cover" />
                  {isEditing && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-md flex flex-col items-center justify-center text-slate-900">
                      <Loader2 className="animate-spin mb-4 text-blue-600" size={48} />
                      <p className="text-sm font-black tracking-[0.3em] uppercase">Refining Artifact...</p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="w-2/5 p-16 flex flex-col border-l border-slate-100 overflow-y-auto custom-scrollbar">
                <div className="flex justify-between items-center mb-12">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
                      <Edit3 size={20} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black tracking-tight leading-none uppercase">Editor Studio</h2>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Consistency Locked</p>
                    </div>
                  </div>
                  <button onClick={() => setEditingImage(null)} className="p-3 text-slate-300 hover:text-slate-900 hover:bg-slate-50 rounded-2xl transition-all">
                    <X size={24} />
                  </button>
                </div>

                <div className="space-y-10 flex-1">
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Upload size={16} className="text-blue-500" /> Brand Logos (PNG)
                      </label>
                      <button 
                        onClick={() => logoInputRef.current?.click()}
                        className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2 hover:bg-blue-50 px-3 py-1 rounded-lg"
                      >
                        <Plus size={12} /> ADD
                      </button>
                      <input type="file" ref={logoInputRef} onChange={handleLogoUpload} className="hidden" accept=".png" />
                    </div>

                    <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar-h">
                      {userLogos.length === 0 && (
                        <div className="w-full py-8 border-2 border-dashed border-slate-100 rounded-[24px] flex items-center justify-center bg-slate-50/30">
                          <p className="text-[10px] font-black uppercase text-slate-300">Upload your logo to start branding</p>
                        </div>
                      )}
                      {userLogos.map((logo) => (
                        <button
                          key={logo.id}
                          onClick={() => setSelectedLogo(selectedLogo === logo.id ? null : logo.id)}
                          className={`relative shrink-0 w-24 h-24 rounded-3xl border-2 transition-all p-3 flex items-center justify-center bg-white shadow-lg ${
                            selectedLogo === logo.id ? 'border-blue-600 scale-105 ring-4 ring-blue-50' : 'border-slate-50'
                          }`}
                        >
                          <img src={logo.data} className="w-full h-full object-contain" />
                          {selectedLogo === logo.id && (
                            <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg">
                              <CheckCircle2 size={14} />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Sparkles size={16} className="text-blue-500" /> Iteration Prompt
                    </label>
                    <textarea 
                      value={editPrompt}
                      onChange={(e) => setEditPrompt(e.target.value)}
                      placeholder="e.g. 'Add the brand logo in the top right corner'..."
                      className="w-full min-h-[160px] p-6 rounded-3xl bg-slate-50 border-2 border-slate-100 text-sm leading-relaxed outline-none focus:bg-white focus:border-blue-600/50 transition-all shadow-inner font-medium resize-none"
                    />
                  </div>

                  <div className="pt-8 space-y-4">
                    <button 
                      disabled={isEditing || !editPrompt}
                      onClick={handleEdit}
                      className="w-full py-5 rounded-2xl bg-slate-900 text-white text-[11px] font-black uppercase tracking-[0.3em] hover:bg-black transition-all flex items-center justify-center gap-3 shadow-xl disabled:opacity-20 active:scale-95"
                    >
                      {isEditing ? <Loader2 size={18} className="animate-spin" /> : <><Sparkles size={18} /> Apply Changes</>}
                    </button>
                    <button 
                      onClick={() => { setLibraryImages(prev => [editingImage!, ...prev]); setEditingImage(null); }}
                      className="w-full py-5 rounded-2xl bg-blue-600 text-white text-[11px] font-black uppercase tracking-[0.3em] hover:bg-blue-700 transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95"
                    >
                      <Archive size={18} /> Commit to Vault
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
        .custom-scrollbar-h::-webkit-scrollbar { height: 4px; }
        .custom-scrollbar-h::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default App;
