
import React, { useRef, useEffect, useState } from 'react';
import { Camera, RefreshCw, Zap, Scan, User, Smile, Hand, Maximize2, Minimize2, Activity, Mic2 } from 'lucide-react';
import * as THREE from 'three';
import { Language, VisualAnalysisResult, HistoryItem } from '../types';
import { translations } from '../locales';
import { analyzeBodyLanguage } from '../services/geminiService';

interface VisualAnalyzerProps {
  lang: Language;
  onSave: (item: HistoryItem) => void;
}

// Helper to access global MediaPipe objects
declare global {
  interface Window {
    Holistic: any;
    Camera: any;
  }
}

const VisualAnalyzer: React.FC<VisualAnalyzerProps> = ({ lang, onSave }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const threeContainerRef = useRef<HTMLDivElement>(null);
  
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<VisualAnalysisResult | null>(null);
  const [realtimeFeedback, setRealtimeFeedback] = useState<string[]>([]);
  const [voiceMetrics, setVoiceMetrics] = useState({ volume: 0, tone: 'Neutral' });
  const [modelLoaded, setModelLoaded] = useState(false);
  const [isTheaterMode, setIsTheaterMode] = useState(true);
  
  const t = translations[lang].visual;
  
  // Three.js References
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  
  // Mesh Groups
  const poseGroupRef = useRef<THREE.Group | null>(null);
  const leftHandGroupRef = useRef<THREE.Group | null>(null);
  const rightHandGroupRef = useRef<THREE.Group | null>(null);
  const faceGroupRef = useRef<THREE.Group | null>(null);
  
  // Points Arrays
  const posePointsRef = useRef<THREE.Mesh[]>([]);
  const leftHandPointsRef = useRef<THREE.Mesh[]>([]);
  const rightHandPointsRef = useRef<THREE.Mesh[]>([]);
  const facePointsRef = useRef<THREE.Mesh[]>([]);

  // Audio Context Ref
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // Cleanup
  useEffect(() => {
    return () => {
      // Stop Video
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      // Stop Three.js
      if (rendererRef.current && threeContainerRef.current) {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        threeContainerRef.current.innerHTML = '';
      }
      // Stop Audio
      if (audioContextRef.current) {
          audioContextRef.current.close();
      }
    };
  }, []);

  // Initialize Audio Analysis
  const initAudioAnalysis = async (stream: MediaStream) => {
      try {
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          
          const microphone = audioCtx.createMediaStreamSource(stream);
          microphone.connect(analyser);

          audioContextRef.current = audioCtx;
          analyserRef.current = analyser;
          microphoneRef.current = microphone;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          
          const updateAudio = () => {
              if (!analyserRef.current) return;
              analyserRef.current.getByteFrequencyData(dataArray);
              
              // Calculate Volume (RMS approximation)
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) {
                  sum += dataArray[i];
              }
              const average = sum / dataArray.length;
              const normalizedVol = Math.min(100, (average / 128) * 100);

              // Simple Tone/Pace Heuristic
              // If consistent high volume -> Excited/Loud
              // If consistent low volume -> Quiet/Timid
              // We'll just update state periodically to avoid re-render thrashing
              
              setVoiceMetrics(prev => ({
                  volume: Math.round(normalizedVol),
                  tone: normalizedVol > 40 ? 'Energetic' : normalizedVol > 10 ? 'Normal' : 'Quiet'
              }));
              
              if(isCameraActive) requestAnimationFrame(updateAudio);
          };
          updateAudio();
      } catch (e) {
          console.error("Audio init failed", e);
      }
  };

  // Initialize Three.js Environment
  const initThreeJS = () => {
      if (!threeContainerRef.current) return;

      const width = threeContainerRef.current.clientWidth;
      const height = threeContainerRef.current.clientHeight;

      const scene = new THREE.Scene();
      sceneRef.current = scene;

      const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
      camera.position.z = 2.5; 
      camera.position.y = 0;
      cameraRef.current = camera;

      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setSize(width, height);
      threeContainerRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
      scene.add(ambientLight);

      // Create Groups
      const poseGroup = new THREE.Group();
      const leftHandGroup = new THREE.Group();
      const rightHandGroup = new THREE.Group();
      const faceGroup = new THREE.Group();
      
      scene.add(poseGroup);
      scene.add(leftHandGroup);
      scene.add(rightHandGroup);
      scene.add(faceGroup);
      
      poseGroupRef.current = poseGroup;
      leftHandGroupRef.current = leftHandGroup;
      rightHandGroupRef.current = rightHandGroup;
      faceGroupRef.current = faceGroup;

      // Helper to create points
      const createPoints = (count: number, color: number, size: number, refArray: React.MutableRefObject<THREE.Mesh[]>, group: THREE.Group) => {
          const geo = new THREE.SphereGeometry(size, 8, 8);
          const mat = new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 0.5 });
          for (let i = 0; i < count; i++) {
              const mesh = new THREE.Mesh(geo, mat);
              mesh.visible = false;
              group.add(mesh);
              refArray.current.push(mesh);
          }
      };

      // Pose: 33 points (Blue)
      createPoints(33, 0x6366f1, 0.04, posePointsRef, poseGroup);
      // Hands: 21 points each (Teal)
      createPoints(21, 0x2dd4bf, 0.02, leftHandPointsRef, leftHandGroup);
      createPoints(21, 0x2dd4bf, 0.02, rightHandPointsRef, rightHandGroup);
      // Face: 468 points - Only creating a subset for performance (Contours)
      // Actually, let's just do key landmarks: Eyes, Nose, Mouth contour. 
      // MediaPipe Holistic Face has 468. Rendering all is heavy. Let's do 0 (no face points) for now to keep FPS high, relying on Logic for face.
      // Or maybe just a few guide points.
      createPoints(10, 0xf43f5e, 0.02, facePointsRef, faceGroup); // 10 key points (lips, eyes)

      const animate = () => {
        if(isCameraActive) requestAnimationFrame(animate);
        renderer.render(scene, camera);
      };
      animate();
  };

  // Main Effect
  useEffect(() => {
    if (!isCameraActive || !videoRef.current) return;

    if (!rendererRef.current) {
        initThreeJS();
    }

    const onResults = (results: any) => {
        setModelLoaded(true);

        // 1. Update Skeleton Meshes
        updateMeshGroup(results.poseLandmarks, posePointsRef.current);
        updateMeshGroup(results.leftHandLandmarks, leftHandPointsRef.current);
        updateMeshGroup(results.rightHandLandmarks, rightHandPointsRef.current);
        
        // Face landmarks - extract key points for visual
        if (results.faceLandmarks) {
            // Map a few indices: 1 (nose tip), 61 (mouth left), 291 (mouth right), 13 (upper lip), 14 (lower lip)
            // 33 (left eye corner), 263 (right eye corner)
            const indices = [1, 61, 291, 13, 14, 33, 263];
            const subset = indices.map(i => results.faceLandmarks[i]);
            updateMeshGroup(subset, facePointsRef.current);
        } else {
             facePointsRef.current.forEach(m => m.visible = false);
        }

        // 2. Deep Analysis Logic
        analyzeHolisticRealtime(results);
    };

    if (window.Holistic) {
        const holistic = new window.Holistic({locateFile: (file: string) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`;
        }});
        
        holistic.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
            refineFaceLandmarks: true // Enable for eye/mouth detail
        });
        
        holistic.onResults(onResults);

        if (window.Camera && videoRef.current) {
            const camera = new window.Camera(videoRef.current, {
                onFrame: async () => {
                    if (videoRef.current) await holistic.send({image: videoRef.current});
                },
                width: 1280,
                height: 720
            });
            camera.start();
        }
    } else {
        alert("MediaPipe Holistic library failed to load.");
    }

    const handleResize = () => {
        if (threeContainerRef.current && cameraRef.current && rendererRef.current) {
            const w = threeContainerRef.current.clientWidth;
            const h = threeContainerRef.current.clientHeight;
            cameraRef.current.aspect = w / h;
            cameraRef.current.updateProjectionMatrix();
            rendererRef.current.setSize(w, h);
        }
    };
    window.addEventListener('resize', handleResize);

    return () => {
        window.removeEventListener('resize', handleResize);
    };
  }, [isCameraActive]);

  const updateMeshGroup = (landmarks: any[], meshes: THREE.Mesh[]) => {
      if (!landmarks || landmarks.length === 0) {
          meshes.forEach(m => m.visible = false);
          return;
      }

      landmarks.forEach((lm, index) => {
          const mesh = meshes[index];
          if (mesh) {
              // Scale and center. Webcam is mirrored, so invert x.
              // MediaPipe: x [0,1], y [0,1]. ThreeJS view approx [-1.5, 1.5]
              mesh.position.set((0.5 - lm.x) * 4, (0.5 - lm.y) * 3, -lm.z * 2);
              mesh.visible = true;
          }
      });
  };

  const analyzeHolisticRealtime = (results: any) => {
      const feedback: string[] = [];
      const { poseLandmarks, leftHandLandmarks, rightHandLandmarks, faceLandmarks } = results;

      // --- 1. Posture (Shoulders & Head) ---
      if (poseLandmarks) {
          const nose = poseLandmarks[0];
          const leftShoulder = poseLandmarks[11];
          const rightShoulder = poseLandmarks[12];
          
          const shoulderSlope = Math.abs(leftShoulder.y - rightShoulder.y);
          if (shoulderSlope > 0.05) {
             feedback.push("⚠️ 肩膀左倾/右倾，请保持水平");
          }

          if (Math.abs(nose.x - (leftShoulder.x + rightShoulder.x)/2) > 0.15) {
             feedback.push("ℹ️ 头部偏离中心");
          }
      }

      // --- 2. Facial Analysis (Smile & Speaking) ---
      if (faceLandmarks) {
          // Mouth Landmarks: 13 (upper), 14 (lower), 61 (left corner), 291 (right corner)
          const upperLip = faceLandmarks[13];
          const lowerLip = faceLandmarks[14];
          const leftCorner = faceLandmarks[61];
          const rightCorner = faceLandmarks[291];

          // Smile Detection: Corners are higher than center of lips usually, or mouth width increases
          // Simple metric: Distance between corners
          const mouthWidth = Math.sqrt(Math.pow(leftCorner.x - rightCorner.x, 2) + Math.pow(leftCorner.y - rightCorner.y, 2));
          
          // Mouth Open: Distance between lips
          const mouthOpen = Math.sqrt(Math.pow(upperLip.x - lowerLip.x, 2) + Math.pow(upperLip.y - lowerLip.y, 2));

          if (mouthWidth > 0.12 || (leftCorner.y < upperLip.y && rightCorner.y < upperLip.y)) { // Heuristic
               feedback.push("😊 笑容保持良好");
          }

          // if (mouthOpen > 0.03) {
          //      feedback.push("🗣️ 正在说话");
          // }
      }

      // --- 3. Hand Details ---
      const analyzeHand = (landmarks: any[], side: string) => {
          if (!landmarks) return null;
          const wrist = landmarks[0];
          const indexTip = landmarks[8];
          const extension = Math.sqrt(Math.pow(indexTip.x - wrist.x, 2) + Math.pow(indexTip.y - wrist.y, 2));
          if (extension < 0.1) return "握拳";
          return "Open";
      };

      const leftStatus = analyzeHand(leftHandLandmarks, "Left");
      const rightStatus = analyzeHand(rightHandLandmarks, "Right");

      if (leftStatus === "握拳" || rightStatus === "握拳") {
          feedback.push("⚠️ 手掌紧握，尝试张开手掌以示自信");
      }

      if (leftHandLandmarks || rightHandLandmarks) {
           feedback.push("✅ 肢体语言活跃");
      }

      // --- 4. Audio Feedback Integration ---
      if (voiceMetrics.volume < 10) {
          feedback.push("📢 声音偏小，请提高音量");
      } else if (voiceMetrics.volume > 80) {
          feedback.push("🔊 声音洪亮，充满能量");
      }

      // De-duplicate and set
      setRealtimeFeedback([...new Set(feedback)]);
  };

  const startCamera = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: true });
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
        }
        await initAudioAnalysis(stream);
        setIsCameraActive(true);
    } catch (err) {
        console.error(err);
        alert("Unable to access camera or microphone.");
    }
  };

  const captureAndAnalyze = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setIsAnalyzing(true);
    
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        ctx.drawImage(videoRef.current, 0, 0);
        
        const base64Image = canvasRef.current.toDataURL('image/jpeg', 0.8);
        try {
            const result = await analyzeBodyLanguage(base64Image);
            setAnalysisResult(result);
            
            // Save to history
            const historyItem: HistoryItem = {
                id: Date.now().toString(),
                type: 'visual',
                date: Date.now(),
                summary: 'Visual Diagnosis',
                details: result
            };
            onSave(historyItem);

        } catch (error) {
            console.error(error);
            alert("Analysis failed.");
        } finally {
            setIsAnalyzing(false);
        }
    }
  };

  return (
    <div className="fade-in max-w-7xl mx-auto pb-4 h-full flex flex-col">
      <div className="mb-4 flex justify-between items-center shrink-0">
        <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Scan className="text-indigo-600" />
                {t.title}
            </h2>
            <p className="text-slate-500 text-sm hidden md:block">{t.subtitle}</p>
        </div>
        <button 
            onClick={() => setIsTheaterMode(!isTheaterMode)}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors hidden md:block"
            title="Toggle Theater Mode"
        >
            {isTheaterMode ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
        </button>
      </div>

      <div className={`grid gap-6 transition-all duration-300 ${isTheaterMode ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-3'}`}>
        
        {/* Main Visual Area */}
        <div className={`
            relative bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-800 group
            ${isTheaterMode ? 'h-[75vh]' : 'h-[500px] lg:col-span-2'}
        `}>
           {/* Webcam Video */}
           <video 
             ref={videoRef}
             className={`absolute inset-0 w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-700 ${isCameraActive ? 'opacity-80' : 'opacity-0'}`}
             playsInline
             muted // Mute local playback to avoid echo, we analyze the stream directly
           />
           
           {/* Three.js Overlay */}
           <div ref={threeContainerRef} className="absolute inset-0 pointer-events-none z-10 transform scale-x-[-1]"></div>
           
           {/* HUD Overlay */}
           {isCameraActive && modelLoaded && (
               <div className="absolute top-6 left-6 z-20 space-y-3">
                   {realtimeFeedback.map((msg, idx) => (
                       <div key={idx} className="flex items-center gap-3 bg-black/60 backdrop-blur-md text-white pl-3 pr-5 py-2 rounded-full text-sm font-medium border-l-4 border-indigo-500 animate-in slide-in-from-left-10 shadow-lg">
                           <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></div>
                           {msg}
                       </div>
                   ))}
               </div>
           )}

           {/* Audio Visualizer (Simple Bar) */}
           {isCameraActive && (
               <div className="absolute bottom-6 right-6 z-20 flex flex-col items-end gap-2">
                   <div className="flex items-center gap-2 text-white bg-black/40 px-3 py-1 rounded-full backdrop-blur-md">
                        <Mic2 size={14} className={voiceMetrics.volume > 50 ? "text-green-400" : "text-white"} />
                        <span className="text-xs font-mono">{voiceMetrics.volume}% Vol</span>
                   </div>
                   <div className="w-2 h-24 bg-slate-700 rounded-full overflow-hidden flex flex-col justify-end">
                       <div 
                         className={`w-full transition-all duration-100 ${voiceMetrics.volume > 80 ? 'bg-red-500' : voiceMetrics.volume > 40 ? 'bg-green-500' : 'bg-yellow-500'}`} 
                         style={{ height: `${voiceMetrics.volume}%` }}
                       ></div>
                   </div>
               </div>
           )}

           <canvas ref={canvasRef} className="hidden" />

           {/* Start Button */}
           {!isCameraActive && (
               <div className="absolute inset-0 flex items-center justify-center z-30">
                   <button 
                     onClick={startCamera}
                     className="group/btn relative flex flex-col items-center gap-4 transition-transform hover:scale-105"
                   >
                       <div className="absolute inset-0 bg-indigo-500 blur-[60px] opacity-20 group-hover/btn:opacity-40 transition-opacity rounded-full"></div>
                       <div className="w-20 h-20 bg-white/10 backdrop-blur-lg rounded-full flex items-center justify-center border border-white/30 shadow-2xl relative z-10">
                         <Camera size={36} className="text-white drop-shadow-md" />
                       </div>
                       <span className="font-bold tracking-widest text-white text-lg drop-shadow-md">{t.startCamera}</span>
                   </button>
               </div>
           )}

            {/* Analyze Button */}
            {isCameraActive && (
                <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-30">
                     <button
                        onClick={captureAndAnalyze}
                        disabled={isAnalyzing}
                        className={`
                            flex items-center gap-3 px-8 py-4 rounded-full font-bold text-white shadow-2xl border border-white/20 backdrop-blur-sm
                            transition-all duration-300
                            ${isAnalyzing ? 'bg-indigo-600/80 cursor-wait w-48 justify-center' : 'bg-indigo-600 hover:bg-indigo-500 hover:scale-105 hover:shadow-indigo-500/50'}
                        `}
                     >
                        {isAnalyzing ? (
                            <><RefreshCw className="animate-spin" size={20} /> 分析中...</>
                        ) : (
                            <><Zap size={22} fill="currentColor" /> {t.analyzeSnapshot}</>
                        )}
                     </button>
                </div>
            )}
            
            {/* Loading Spinner */}
            {isCameraActive && !modelLoaded && (
                <div className="absolute inset-0 flex items-center justify-center z-20 bg-slate-900/80 backdrop-blur-sm">
                    <div className="text-white flex flex-col items-center gap-3">
                        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="font-mono text-sm tracking-wider">INITIALIZING AI MODELS...</span>
                    </div>
                </div>
            )}
        </div>

        {/* Analysis Results Panel - Shifts to side or bottom based on mode */}
        <div className={`
             bg-white rounded-2xl p-6 shadow-lg border border-slate-100 flex flex-col overflow-hidden
             ${isTheaterMode ? 'min-h-[200px]' : 'h-[500px]'}
        `}>
            <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4 shrink-0">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Activity size={20} className="text-indigo-600"/>
                    {t.resultTitle}
                </h3>
                {analysisResult && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md font-bold">已生成</span>}
            </div>

            {analysisResult ? (
                <div className="space-y-6 overflow-y-auto custom-scrollbar pr-2">
                    <div className={`grid gap-4 ${isTheaterMode ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1'}`}>
                        <div className="bg-gradient-to-br from-indigo-50 to-white p-4 rounded-xl border border-indigo-100 shadow-sm">
                             <div className="flex items-center gap-2 mb-2 text-indigo-700 font-bold text-sm">
                                <Smile size={16} /> {t.expression}
                             </div>
                             <p className="text-slate-600 text-sm leading-relaxed">{analysisResult.expression}</p>
                        </div>
                        <div className="bg-gradient-to-br from-purple-50 to-white p-4 rounded-xl border border-purple-100 shadow-sm">
                             <div className="flex items-center gap-2 mb-2 text-purple-700 font-bold text-sm">
                                <User size={16} /> {t.posture}
                             </div>
                             <p className="text-slate-600 text-sm leading-relaxed">{analysisResult.posture}</p>
                        </div>
                        <div className="bg-gradient-to-br from-blue-50 to-white p-4 rounded-xl border border-blue-100 shadow-sm">
                             <div className="flex items-center gap-2 mb-2 text-blue-700 font-bold text-sm">
                                <Hand size={16} /> {t.eyeContact} & 手势
                             </div>
                             <p className="text-slate-600 text-sm leading-relaxed">{analysisResult.eyeContact}</p>
                        </div>
                    </div>

                    <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                        <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-sm uppercase tracking-wide">
                             <Zap size={16} className="text-amber-500" fill="currentColor"/>
                             {t.suggestions}
                        </h4>
                        <ul className="space-y-3">
                            {analysisResult.suggestions.map((s, i) => (
                                <li key={i} className="flex gap-3 text-sm text-slate-700 group">
                                    <span className="w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center shrink-0 text-xs font-bold text-slate-400 group-hover:text-indigo-600 group-hover:border-indigo-200 transition-colors">
                                        {i + 1}
                                    </span>
                                    <span className="leading-snug">{s}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400">
                     <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 rotate-3">
                        <Scan size={32} className="opacity-50" />
                    </div>
                    <p className="text-sm font-medium text-slate-500 mb-1">{t.instruction}</p>
                    <p className="text-xs text-slate-400">拍摄快照以获取 AI 深度报告</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default VisualAnalyzer;
