
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Clock, Paperclip, Smile, Send, X, ChevronDown, Globe } from "lucide-react";
import { EmojiPicker } from "./EmojiPicker";
import { DrawingToolsMenu } from "./DrawingToolsMenu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AttachmentWithType {
  url: string;
  type: string;
  name: string;
}

interface CommentInputProps {
  currentTime: number;
  onAddComment: (text: string, attachments?: AttachmentWithType[], isInternal?: boolean, attachTime?: boolean, hasDrawing?: boolean) => void;
  parentId?: string;
  onCancel?: () => void;
  placeholder?: string;
  onStartDrawing?: () => void;
  isDrawingMode?: boolean;
}

export const CommentInput = ({ 
  currentTime, 
  onAddComment, 
  parentId, 
  onCancel,
  placeholder = "Leave your comment...",
  onStartDrawing,
  isDrawingMode = false
}: CommentInputProps) => {
  const [comment, setComment] = useState("");
  const [attachments, setAttachments] = useState<AttachmentWithType[]>([]);
  const [isInternal, setIsInternal] = useState(false);
  const [attachTime, setAttachTime] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showDrawingTools, setShowDrawingTools] = useState(false);
  const [hasDrawing, setHasDrawing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const drawingCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Monitor canvas for drawings more aggressively
  useEffect(() => {
    const checkForDrawings = () => {
      const canvas = (window as any).drawingCanvas;
      if (canvas && canvas.hasDrawingsForCurrentFrame) {
        const hasAnyDrawings = canvas.hasDrawingsForCurrentFrame();
        
        if (hasAnyDrawings !== hasDrawing) {
          setHasDrawing(hasAnyDrawings);
          console.log('Drawing detection updated:', hasAnyDrawings);
        }
      }
    };

    if (isDrawingMode) {
      checkForDrawings();
      // More frequent checks when in drawing mode
      drawingCheckIntervalRef.current = setInterval(checkForDrawings, 200);
    } else {
      if (drawingCheckIntervalRef.current) {
        clearInterval(drawingCheckIntervalRef.current);
        drawingCheckIntervalRef.current = null;
      }
    }

    return () => {
      if (drawingCheckIntervalRef.current) {
        clearInterval(drawingCheckIntervalRef.current);
        drawingCheckIntervalRef.current = null;
      }
    };
  }, [isDrawingMode, currentTime, hasDrawing]);

  useEffect(() => {
    if (!isDrawingMode) {
      console.log('Drawing mode disabled, closing drawing tools');
      setShowDrawingTools(false);
    }
  }, [isDrawingMode]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 🎬 HELPER: Pause video function
  const pauseVideo = (reason: string) => {
    const video = document.querySelector('video') as HTMLVideoElement;
    if (video && !video.paused) {
      video.pause();
      console.log(`📹 Video paused for ${reason}`);
    }
  };

  // ✍️ NEW: Handle when user starts typing (textarea gets focus)
  const handleTextareaFocus = () => {
    pauseVideo('comment writing');
  };

  const handleSubmit = () => {
    if (comment.trim()) {
      const canvas = (window as any).drawingCanvas;
      
      // Enhanced force save process with verification
      if (canvas && hasDrawing) {
        console.log('CRITICAL: Starting enhanced save process for drawing comment');
        
        // Force save multiple times to ensure persistence
        const performMultipleSaves = () => {
          for (let i = 0; i < 5; i++) {
            setTimeout(() => {
              canvas.forceSave();
              console.log(`Force save attempt ${i + 1}`);
            }, i * 50);
          }
        };
        
        performMultipleSaves();
        
        // Wait for saves to complete, then verify and submit
        setTimeout(() => {
          // Final verification
          const allDrawings = canvas.getAllFrameDrawings ? canvas.getAllFrameDrawings() : [];
          const currentFrame = Math.floor(currentTime * 30);
          const frameDrawing = allDrawings.find((d: any) => d.frame === currentFrame);
          
          console.log('Final verification:');
          console.log('- Current frame:', currentFrame);
          console.log('- Frame has drawing data:', !!frameDrawing);
          console.log('- Total stored frames:', allDrawings.length);
          
          if (frameDrawing) {
            console.log('- Drawing data length:', frameDrawing.canvasData?.length || 0);
          }
          
          // Submit the comment
          console.log('Submitting comment with hasDrawing:', hasDrawing);
          onAddComment(comment.trim(), attachments, isInternal, attachTime, hasDrawing);
          
          // Reset states but DON'T clear the canvas - let it persist
          setComment("");
          setAttachments([]);
          setIsInternal(false);
          setAttachTime(true);
          setHasDrawing(false);
          setShowDrawingTools(false);
          setShowEmojiPicker(false);
          
          if (onCancel) onCancel();
        }, 500); // Increased wait time for saves to complete
      } else {
        // No drawings, submit immediately
        console.log('Submitting comment without drawings');
        onAddComment(comment.trim(), attachments, isInternal, attachTime, hasDrawing);
        
        setComment("");
        setAttachments([]);
        setIsInternal(false);
        setAttachTime(true);
        setHasDrawing(false);
        setShowDrawingTools(false);
        setShowEmojiPicker(false);
        
        if (onCancel) onCancel();
      }
    }
  };

  // 📎 ENHANCED: Handle attachment button with video pausing
  const handleAttachmentClick = () => {
    pauseVideo('attachment selection');
    fileInputRef.current?.click();
  };

  // 🔧 ENHANCED: Better file handling with type detection
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    const newAttachments = files.map(file => {
      const url = URL.createObjectURL(file);
      return {
        url,
        type: file.type,
        name: file.name
      };
    });
    
    setAttachments([...attachments, ...newAttachments]);
    console.log('📎 Added attachments:', newAttachments);
  };

  const removeAttachment = (index: number) => {
    const removedAttachment = attachments[index];
    // Clean up blob URL to prevent memory leaks
    if (removedAttachment.url.startsWith('blob:')) {
      URL.revokeObjectURL(removedAttachment.url);
    }
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  // 😊 ENHANCED: Handle emoji button with video pausing
  const handleEmojiClick = () => {
    pauseVideo('emoji picker');
    setShowEmojiPicker(!showEmojiPicker);
  };

  const addEmoji = (emoji: string) => {
    setComment(comment + emoji);
    setShowEmojiPicker(false);
  };

  const toggleAttachTime = () => {
    setAttachTime(!attachTime);
  };

  const handleDrawingClick = () => {
    console.log('Drawing button clicked - current states:', { isDrawingMode, showDrawingTools });
    
    if (!isDrawingMode) {
      console.log('Starting drawing mode - pausing video and enabling drawing');
      
      // CRITICAL: Always pause video when starting drawing mode
      const video = document.querySelector('video');
      if (video && !video.paused) {
        video.pause();
        console.log('Video paused for drawing mode');
      }
      
      if (onStartDrawing) {
        onStartDrawing();
      }
      setShowDrawingTools(true);
    } else {
      console.log('Drawing mode already active - toggling tools menu');
      
      // If drawing mode is already active, just toggle the tools menu
      // But ensure video stays paused
      const video = document.querySelector('video');
      if (video && !video.paused) {
        video.pause();
        console.log('Video re-paused to maintain drawing mode');
      }
      
      setShowDrawingTools(!showDrawingTools);
    }
  };

  // 🎨 Get file type icon
  const getFileTypeIcon = (attachment: AttachmentWithType) => {
    const { type } = attachment;
    
    if (type.startsWith('image/')) {
      return <span className="text-blue-400">🖼️</span>;
    }
    if (type.startsWith('video/')) {
      return <span className="text-purple-400">🎬</span>;
    }
    if (type.startsWith('audio/')) {
      return <span className="text-green-400">🎵</span>;
    }
    if (type === 'application/pdf') {
      return <span className="text-red-400">📄</span>;
    }
    if (type.includes('zip') || type.includes('rar') || type.includes('archive')) {
      return <span className="text-orange-400">📦</span>;
    }
    if (type.includes('text') || type.includes('document')) {
      return <span className="text-blue-400">📝</span>;
    }
    
    return <span className="text-gray-400">📄</span>;
  };

  return (
    <div className="bg-gray-800/90 backdrop-blur-sm">
      <div className="max-w-4xl mx-auto">
        {/* Attachments display */}
        {attachments.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachments.map((attachment, index) => (
              <div key={index} className="relative bg-gray-700 rounded-lg p-2 flex items-center space-x-2">
                {getFileTypeIcon(attachment)}
                <span className="text-xs text-gray-300 truncate max-w-32">
                  {attachment.name}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeAttachment(index)}
                  className="h-4 w-4 p-0 text-gray-400 hover:text-red-400"
                >
                  <X size={12} />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Drawing indicator */}
        {hasDrawing && (
          <div className="mb-3">
            <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-2 flex items-center space-x-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400">
                <path d="M12 19l7-7 3 3-7 7-3-3z"/>
                <path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
                <path d="m2 2 7.586 7.586"/>
                <circle cx="11" cy="11" r="2"/>
              </svg>
              <span className="text-xs text-blue-400 font-medium">Drawing attached</span>
            </div>
          </div>
        )}

        <div className="bg-gray-700/50 rounded-lg p-3">
          {/* Main textarea with styled placeholder */}
          <div className="mb-3 relative">
            {attachTime && (
              <div className="absolute top-3 left-3 z-10 pointer-events-none">
                <div className="flex items-center space-x-1 bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full text-sm font-medium">
                  <Clock size={12} />
                  <span>{formatTime(currentTime)}</span>
                </div>
              </div>
            )}
            {/* ✍️ ENHANCED: Textarea with focus handler to pause video */}
            <Textarea
              placeholder={attachTime ? ` - ${placeholder}` : placeholder}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onFocus={handleTextareaFocus}
              className={`bg-gray-800 border-gray-600 text-white placeholder-gray-400 resize-none min-h-[80px] focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                attachTime ? 'pl-20' : ''
              }`}
              rows={3}
            />
          </div>
          
          {/* Bottom toolbar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileUpload}
              />
              
              {/* Time attach button */}
              <Button
                size="sm"
                variant="ghost"
                onClick={toggleAttachTime}
                className={`p-2 rounded-lg ${
                  attachTime 
                    ? "text-blue-400 bg-blue-500/20" 
                    : "text-gray-400 hover:text-white hover:bg-gray-600"
                }`}
                title={attachTime ? `Attach ${formatTime(currentTime)}` : "Don't attach time"}
              >
                <Clock size={18} />
              </Button>
              
              {/* 📎 ENHANCED: Attachment button with video pausing */}
              <Button
                size="sm"
                variant="ghost"
                onClick={handleAttachmentClick}
                className="text-gray-400 hover:text-white hover:bg-gray-600 p-2 rounded-lg"
                title="Attach files (pauses video)"
              >
                <Paperclip size={18} />
              </Button>
              
              {/* Drawing tools button */}
              <div className="relative drawing-area" data-drawing-menu>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDrawingClick}
                  className={`p-2 rounded-lg ${
                    isDrawingMode || hasDrawing
                      ? "text-blue-400 bg-blue-500/20" 
                      : "text-gray-400 hover:text-white hover:bg-gray-600"
                  }`}
                  title="Drawing tools"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 19l7-7 3 3-7 7-3-3z"/>
                    <path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
                    <path d="m2 2 7.586 7.586"/>
                    <circle cx="11" cy="11" r="2"/>
                  </svg>
                </Button>
                {showDrawingTools && (
                  <DrawingToolsMenu onClose={() => setShowDrawingTools(false)} />
                )}
              </div>
              
              {/* 😊 ENHANCED: Emoji button with video pausing */}
              <div className="relative">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleEmojiClick}
                  className="text-gray-400 hover:text-white hover:bg-gray-600 p-2 rounded-lg"
                  title="Add emoji (pauses video)"
                >
                  <Smile size={18} />
                </Button>
                {showEmojiPicker && (
                  <EmojiPicker onEmojiSelect={addEmoji} onClose={() => setShowEmojiPicker(false)} />
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {/* Public/Internal dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-300 hover:text-white hover:bg-gray-600 p-2 rounded-lg flex items-center"
                    title={isInternal ? "Internal comment" : "Public comment"}
                  >
                    {isInternal ? (
                      <div className="w-4 h-4 rounded-full bg-orange-500"></div>
                    ) : (
                      <Globe size={18} />
                    )}
                    <ChevronDown size={14} className="ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-gray-800 border-gray-600 text-white">
                  <DropdownMenuItem
                    onClick={() => setIsInternal(false)}
                    className="hover:bg-gray-700 focus:bg-gray-700"
                  >
                    <Globe size={16} className="mr-2" />
                    Public
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setIsInternal(true)}
                    className="hover:bg-gray-700 focus:bg-gray-700"
                  >
                    <div className="w-4 h-4 mr-2 rounded-full bg-orange-500"></div>
                    Internal
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              {/* Send button */}
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={!comment.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={16} />
              </Button>
            </div>
          </div>
        </div>

        {onCancel && (
          <div className="mt-2 flex justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={onCancel}
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
