import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bot, 
  Sparkles, 
  Music, 
  Image as ImageIcon, 
  MessageSquare, 
  Loader2,
  Wand2,
  Disc3,
  Zap,
  Search,
  History,
  X,
  Send,
  CheckCircle2
} from 'lucide-react';
import api from '../config/axios';

const AgentPanel = ({ trackId, trackData, onAnalysisComplete }) => {
  const [agentStatus, setAgentStatus] = useState('idle'); // idle, analyzing, complete, error
  const [results, setResults] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('chat'); // chat, analysis, cover, history
  const [coverStyle, setCoverStyle] = useState('modern');
  const [coverVibe, setCoverVibe] = useState('energetic');
  const chatEndRef = useRef(null);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const runFullAnalysis = async () => {
    if (!trackId) return;
    setAgentStatus('analyzing');
    setActiveTab('analysis');
    
    try {
      const response = await api.post('/api/agent/quick-analyze/' + trackId);
      setResults(response.data);
      setAgentStatus('complete');
      if (onAnalysisComplete) {
        onAnalysisComplete(response.data);
      }
    } catch (error) {
      console.error('Agent analysis failed:', error);
      setAgentStatus('error');
    }
  };

  const generateCover = async () => {
    if (!trackId) return;
    setAgentStatus('analyzing');
    setActiveTab('cover');
    
    try {
      const response = await api.post('/api/agent/generate-cover/' + trackId, {
        style: coverStyle,
        vibe: coverVibe
      });
      
      setResults(prev => ({ 
        ...prev, 
        coverArt: response.data,
        coverPrompt: response.data.prompt
      }));
      setAgentStatus('complete');
    } catch (error) {
      console.error('Cover generation failed:', error);
      setAgentStatus('error');
    }
  };

  const identifyTrack = async () => {
    if (!trackId) return;
    setAgentStatus('analyzing');
    setActiveTab('analysis');
    
    try {
      const response = await api.post('/api/agent/identify/' + trackId);
      
      setResults(prev => ({ 
        ...prev, 
        identification: response.data.identification || response.data
      }));
      setAgentStatus('complete');
    } catch (error) {
      console.error('Track identification failed:', error);
      setAgentStatus('error');
    }
  };

  const chatWithAgent = async (message) => {
    if (!message.trim()) return;
    
    const userMessage = message.trim();
    setChatInput('');
    
    // Add user message to history
    const newHistory = [...chatHistory, { role: 'user', content: userMessage }];
    setChatHistory(newHistory);
    setAgentStatus('analyzing');
    
    try {
      const response = await api.post('/api/agent/chat', {
        message: userMessage,
        trackId,
        context: chatHistory.slice(-10) // Keep last 10 messages for context
      });
      
      setChatHistory(response.data.context);
      setAgentStatus('idle');
    } catch (error) {
      console.error('Chat failed:', error);
      setChatHistory([...newHistory, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.' 
      }]);
      setAgentStatus('error');
    }
  };

  const loadMemory = async () => {
    if (!trackId) return;
    
    try {
      const response = await api.get('/api/agent/memory/' + trackId);
      if (response.data.history?.length > 0) {
        setResults(prev => ({ ...prev, memory: response.data.history }));
      }
    } catch (error) {
      console.error('Load memory failed:', error);
    }
  };

  useEffect(() => {
    if (trackId && isExpanded) {
      loadMemory();
    }
  }, [trackId, isExpanded]);

  const statusColors = {
    idle: 'text-text-muted',
    analyzing: 'text-accent-secondary',
    complete: 'text-create-red',
    error: 'text-error'
  };

  const statusIcons = {
    idle: Bot,
    analyzing: Loader2,
    complete: CheckCircle2,
    error: X
  };

  const StatusIcon = statusIcons[agentStatus];

  if (!isExpanded) {
    return (
      <motion.button
        onClick={() => setIsExpanded(true)}
        className="fixed bottom-8 right-6 z-50 w-10 h-10 rounded-lg bg-background-elevated border border-mixer-border
                   flex items-center justify-center shadow-lg hover:border-deck-a/50 hover:shadow-glow-deck-a
                   transition-all duration-300"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <Bot className="w-5 h-5 text-text-muted" />
        <motion.div
          className="absolute -top-1 -right-1 w-4 h-4 bg-accent-secondary rounded-full"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      className="fixed bottom-8 right-6 z-50 w-96 bg-background-secondary/95 backdrop-blur-xl rounded-xl 
                 border border-mixer-border shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-create-red-dim to-transparent p-4 border-b border-create-red/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-create-red to-create-red-dark 
                            flex items-center justify-center shadow-glow-sm">
                <Bot className="w-5 h-5 text-black" />
              </div>
              <motion.div
                className="absolute inset-0 rounded-xl bg-create-red blur-lg opacity-50"
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
            <div>
              <h3 className="font-bold text-white">AI Agent</h3>
              <p className={`text-xs flex items-center gap-1 ${statusColors[agentStatus]}`}>
                <StatusIcon className={`w-3 h-3 ${agentStatus === 'analyzing' ? 'animate-spin' : ''}`} />
                {agentStatus === 'idle' ? 'Ready' : 
                 agentStatus === 'analyzing' ? 'Thinking...' :
                 agentStatus === 'complete' ? 'Done' : 'Error'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsExpanded(false)}
            className="p-2 hover:bg-create-red-dim rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-text-secondary" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-create-red/20">
        {[
          { id: 'chat', icon: MessageSquare, label: 'Chat' },
          { id: 'analysis', icon: Sparkles, label: 'Analyze' },
          { id: 'cover', icon: ImageIcon, label: 'Cover' },
          { id: 'history', icon: History, label: 'History' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium
                       transition-colors relative ${
              activeTab === tab.id 
                ? 'text-create-red' 
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
            {activeTab === tab.id && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-create-red to-create-red-light"
              />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="h-80 overflow-y-auto p-4">
        <AnimatePresence mode="wait">
          {/* Chat Tab */}
          {activeTab === 'chat' && (
            <motion.div
              key="chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full flex flex-col"
            >
              <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                {chatHistory.length === 0 ? (
                  <div className="text-center text-text-muted py-8">
                    <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">Ask me anything about your tracks!</p>
                    <p className="text-xs mt-1">I can analyze, identify, and suggest improvements.</p>
                  </div>
                ) : (
                  chatHistory.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                          msg.role === 'user'
                            ? 'bg-create-red text-black rounded-br-md'
                            : 'bg-background-tertiary text-text-secondary rounded-bl-md'
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && chatWithAgent(chatInput)}
                  placeholder="Ask about this track..."
                  className="flex-1 bg-background-tertiary border border-create-red/20 rounded-xl px-4 py-2 
                           text-sm text-white placeholder-text-muted focus:outline-none 
                           focus:border-create-red/50 transition-colors"
                />
                <button
                  onClick={() => chatWithAgent(chatInput)}
                  disabled={!chatInput.trim() || agentStatus === 'analyzing'}
                  className="p-2 bg-create-red hover:bg-create-red-dark disabled:opacity-50 
                           rounded-xl transition-colors"
                >
                  <Send className="w-5 h-5 text-black" />
                </button>
              </div>
            </motion.div>
          )}

          {/* Analysis Tab */}
          {activeTab === 'analysis' && (
            <motion.div
              key="analysis"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {!trackId ? (
                <div className="text-center text-text-muted py-8">
                  <Music className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Select a track to analyze</p>
                </div>
              ) : (
                <>
                  <button
                    onClick={runFullAnalysis}
                    disabled={agentStatus === 'analyzing'}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r 
                             from-create-red to-create-red-dark hover:from-create-red-light hover:to-create-red
                             disabled:opacity-50 text-black font-semibold py-3 rounded-xl 
                             transition-all duration-300 shadow-glow-sm"
                  >
                    {agentStatus === 'analyzing' ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Sparkles className="w-5 h-5" />
                    )}
                    {agentStatus === 'analyzing' ? 'Analyzing...' : 'Full AI Analysis'}
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={identifyTrack}
                      disabled={agentStatus === 'analyzing'}
                      className="flex items-center justify-center gap-2 bg-background-tertiary 
                               hover:bg-create-red-dim disabled:opacity-50 text-text-secondary 
                               py-2 rounded-xl transition-colors text-sm border border-create-red/10"
                    >
                      <Search className="w-4 h-4" />
                      Identify
                    </button>
                    <button
                      onClick={() => setActiveTab('cover')}
                      className="flex items-center justify-center gap-2 bg-background-tertiary 
                               hover:bg-create-red-dim text-text-secondary py-2 rounded-xl 
                               transition-colors text-sm border border-create-red/10"
                    >
                      <ImageIcon className="w-4 h-4" />
                      Cover Art
                    </button>
                  </div>

                  {results?.analysis && (
                    <div className="bg-background-tertiary rounded-xl p-3 space-y-2 border border-create-red/10">
                      <h4 className="font-medium text-create-red text-sm flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        Analysis Results
                      </h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {results.analysis.duration && (
                          <div className="bg-background-secondary rounded-lg p-2">
                            <span className="text-text-muted text-xs">Duration</span>
                            <p className="text-white font-medium">
                              {Math.floor(results.analysis.duration / 60)}:
                              {String(Math.floor(results.analysis.duration % 60)).padStart(2, '0')}
                            </p>
                          </div>
                        )}
                        {results.analysis.format && (
                          <div className="bg-background-secondary rounded-lg p-2">
                            <span className="text-text-muted text-xs">Format</span>
                            <p className="text-white font-medium uppercase">
                              {results.analysis.format}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {results?.identification && (
                    <div className="bg-background-tertiary rounded-xl p-3 space-y-2 border border-create-red/10">
                      <h4 className="font-medium text-create-red text-sm flex items-center gap-2">
                        <Disc3 className="w-4 h-4" />
                        Track Identification
                      </h4>
                      <div className="space-y-1 text-sm">
                        {results.identification.genre && (
                          <p className="text-text-secondary">
                            <span className="text-text-muted">Genre:</span> {results.identification.genre}
                          </p>
                        )}
                        {results.identification.mood && (
                          <p className="text-text-secondary">
                            <span className="text-text-muted">Mood:</span> {results.identification.mood}
                          </p>
                        )}
                        {results.identification.energy && (
                          <p className="text-text-secondary">
                            <span className="text-text-muted">Energy:</span> {results.identification.energy}
                          </p>
                        )}
                        {results.identification.confidence && (
                          <div className="flex items-center gap-2 mt-2">
                            <div className="flex-1 bg-background-secondary rounded-full h-2">
                              <div 
                                className="bg-create-red h-2 rounded-full transition-all"
                                style={{ width: `${results.identification.confidence}%` }}
                              />
                            </div>
                            <span className="text-xs text-text-muted">
                              {results.identification.confidence}% confidence
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}

          {/* Cover Art Tab */}
          {activeTab === 'cover' && (
            <motion.div
              key="cover"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {!trackId ? (
                <div className="text-center text-text-muted py-8">
                  <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Select a track to generate cover art</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-sm text-text-muted">Style</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['modern', 'retro', 'minimal'].map(style => (
                        <button
                          key={style}
                          onClick={() => setCoverStyle(style)}
                          className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                            coverStyle === style
                              ? 'bg-create-red text-black'
                              : 'bg-background-tertiary text-text-secondary hover:text-create-red border border-create-red/10'
                          }`}
                        >
                          {style.charAt(0).toUpperCase() + style.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-text-muted">Vibe</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['energetic', 'chill', 'dark'].map(vibe => (
                        <button
                          key={vibe}
                          onClick={() => setCoverVibe(vibe)}
                          className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                            coverVibe === vibe
                              ? 'bg-accent-secondary text-black'
                              : 'bg-background-tertiary text-text-secondary hover:text-accent-secondary border border-create-red/10'
                          }`}
                        >
                          {vibe.charAt(0).toUpperCase() + vibe.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={generateCover}
                    disabled={agentStatus === 'analyzing'}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r 
                             from-accent-secondary to-accent-purple hover:opacity-90
                             disabled:opacity-50 text-black font-semibold py-3 rounded-xl 
                             transition-all duration-300"
                  >
                    {agentStatus === 'analyzing' ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Wand2 className="w-5 h-5" />
                    )}
                    Generate Cover Prompt
                  </button>

                  {results?.coverPrompt && (
                    <div className="bg-background-tertiary rounded-xl p-3 border border-create-red/10">
                      <h4 className="font-medium text-accent-secondary text-sm mb-2 flex items-center gap-2">
                        <ImageIcon className="w-4 h-4" />
                        Generated Prompt
                      </h4>
                      <p className="text-sm text-text-secondary leading-relaxed">
                        {results.coverPrompt}
                      </p>
                      <p className="text-xs text-text-muted mt-2">
                        Use this prompt with DALL-E, Midjourney, or Stable Diffusion
                      </p>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              {!results?.memory || results.memory.length === 0 ? (
                <div className="text-center text-text-muted py-8">
                  <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No agent history yet</p>
                  <p className="text-xs mt-1">Run an analysis to see history</p>
                </div>
              ) : (
                results.memory.map((item, i) => (
                  <div key={i} className="bg-background-tertiary rounded-xl p-3 border border-create-red/10">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-create-red">
                        {item.action}
                      </span>
                      <span className="text-xs text-text-muted">
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-text-muted">
                      {item.result ? 'Analysis completed' : 'No result'}
                    </p>
                  </div>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default AgentPanel;
