import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Clock, MessageSquare, Reply, Trash2, Paperclip, Smile, Send, Search, Eye, FileText, Image as ImageIcon, Video, Music, Archive, File } from "lucide-react";
import { CommentInput } from "@/components/CommentInput";
import { Textarea } from "@/components/ui/textarea";
import { CommentContextMenu } from "@/components/CommentContextMenu";
import { CommentFilterMenu, type CommentFilters } from "@/components/CommentFilterMenu";
import { CommentSortMenu, type SortOption } from "@/components/CommentSortMenu";
import { CommentActionsMenu } from "@/components/CommentActionsMenu";
import { CommentTypeFilter, type CommentType } from "@/components/CommentTypeFilter";
import { AttachmentViewer } from "@/components/AttachmentViewer";
import type { Comment } from "@/pages/Index";

interface AttachmentWithType {
  url: string;
  type: string;
  name: string;
}

interface CommentPanelProps {
  comments: Comment[];
  currentTime: number;
  onCommentClick: (timestamp: number) => void;
  onDeleteComment: (commentId: string) => void;
  onReplyComment: (parentId: string, text: string, attachments?: AttachmentWithType[], isInternal?: boolean, attachTime?: boolean, hasDrawing?: boolean) => void;
  onAddComment: (text: string, attachments?: AttachmentWithType[], isInternal?: boolean, attachTime?: boolean, hasDrawing?: boolean) => void;
  onStartDrawing?: () => void;
  isDrawingMode?: boolean;
}

export const CommentPanel = ({
  comments,
  currentTime,
  onCommentClick,
  onDeleteComment,
  onReplyComment,
  onAddComment,
  onStartDrawing,
  isDrawingMode = false,
}: CommentPanelProps) => {
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCommentType, setSelectedCommentType] = useState<CommentType>('all');
  const [sortBy, setSortBy] = useState<SortOption>('timecode');
  const [filters, setFilters] = useState<CommentFilters>({
    annotations: false,
    attachments: false,
    completed: false,
    incomplete: false,
    unread: false,
    mentionsAndReactions: false,
  });

  // 🆕 NEW: Attachment viewer state
  const [selectedAttachment, setSelectedAttachment] = useState<AttachmentWithType | null>(null);
  const [selectedAttachmentIndex, setSelectedAttachmentIndex] = useState(0);
  const [isAttachmentViewerOpen, setIsAttachmentViewerOpen] = useState(false);

  // 🎯 NEW: Enhanced file type detection for proper icons
  const getFileTypeIcon = (attachment: AttachmentWithType, size = 12) => {
    const { type } = attachment;
    
    if (type.startsWith('image/')) {
      return <ImageIcon size={size} className="text-blue-400" />;
    }
    if (type.startsWith('video/')) {
      return <Video size={size} className="text-purple-400" />;
    }
    if (type.startsWith('audio/')) {
      return <Music size={size} className="text-green-400" />;
    }
    if (type === 'application/pdf') {
      return <FileText size={size} className="text-red-400" />;
    }
    if (type.includes('text') || type.includes('document')) {
      return <FileText size={size} className="text-blue-400" />;
    }
    if (type.includes('zip') || type.includes('rar') || type.includes('archive')) {
      return <Archive size={size} className="text-orange-400" />;
    }
    
    return <File size={size} className="text-gray-400" />;
  };

  // 📎 Truncate attachment names
  const truncateFileName = (name: string, maxLength = 20) => {
    if (name.length <= maxLength) return name;
    
    const extension = name.split('.').pop();
    const nameWithoutExt = name.substring(0, name.lastIndexOf('.'));
    const maxNameLength = maxLength - (extension ? extension.length + 4 : 3);
    
    if (extension && nameWithoutExt.length > maxNameLength) {
      return `${nameWithoutExt.substring(0, maxNameLength)}...${extension}`;
    }
    return `${name.substring(0, maxLength - 3)}...`;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTopLevelComments = () => {
    let filteredComments = comments.filter(comment => !comment.parentId);

    // Apply search filter
    if (searchTerm) {
      filteredComments = filteredComments.filter(comment =>
        comment.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
        comment.author.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply type filter
    if (selectedCommentType === 'public') {
      filteredComments = filteredComments.filter(comment => !comment.text.includes('internal'));
    } else if (selectedCommentType === 'internal') {
      filteredComments = filteredComments.filter(comment => comment.text.includes('internal'));
    }

    // Apply advanced filters
    if (filters.attachments) {
      filteredComments = filteredComments.filter(comment => comment.attachments && comment.attachments.length > 0);
    }

    // Apply sorting
    let sortedComments;
    switch (sortBy) {
      case 'oldest':
        sortedComments = filteredComments.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        break;
      case 'newest':
        sortedComments = filteredComments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        break;
      case 'commenter':
        sortedComments = filteredComments.sort((a, b) => a.author.localeCompare(b.author));
        break;
      case 'timecode':
      default:
        sortedComments = filteredComments.sort((a, b) => a.timestamp - b.timestamp);
        break;
    }

    // Add comment numbers based on original order (by timestamp)
    const allTopLevelByTimestamp = comments
      .filter(comment => !comment.parentId && comment.timestamp >= 0)
      .sort((a, b) => a.timestamp - b.timestamp);
    
    return sortedComments.map(comment => {
      const commentNumber = allTopLevelByTimestamp.findIndex(c => c.id === comment.id) + 1;
      return { ...comment, commentNumber };
    });
  };

  const getReplies = (parentId: string) => {
    return comments.filter(comment => comment.parentId === parentId);
  };

  const getCommentCounts = () => {
    const topLevel = comments.filter(comment => !comment.parentId);
    return {
      all: topLevel.length,
      public: topLevel.filter(comment => !comment.text.includes('internal')).length,
      internal: topLevel.filter(comment => comment.text.includes('internal')).length,
    };
  };

  const handleReply = (parentId: string) => {
    if (replyText.trim()) {
      onReplyComment(parentId, replyText.trim());
      setReplyText("");
      setReplyingTo(null);
    }
  };

  const handleCancel = () => {
    setReplyText("");
    setReplyingTo(null);
  };

  const handleClearFilters = () => {
    setFilters({
      annotations: false,
      attachments: false,
      completed: false,
      incomplete: false,
      unread: false,
      mentionsAndReactions: false,
    });
    setSearchTerm("");
    setSelectedCommentType('all');
    setSortBy('timecode');
  };

  const handleCopyComments = () => {
    const visibleComments = getTopLevelComments();
    const commentText = visibleComments.map(comment => 
      `${formatTime(comment.timestamp)} - ${comment.author}: ${comment.text}`
    ).join('\n');
    navigator.clipboard.writeText(commentText);
    console.log('Comments copied to clipboard');
  };

  const handleExportComments = () => {
    const visibleComments = getTopLevelComments();
    const csvContent = [
      'Timestamp,Author,Text,Created At',
      ...visibleComments.map(comment => 
        `${formatTime(comment.timestamp)},${comment.author},"${comment.text}",${comment.createdAt.toISOString()}`
      )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'comments.csv';
    a.click();
    console.log('Comments exported');
  };

  const handleEditComment = (commentId: string) => {
    console.log('Edit comment:', commentId);
  };

  const handleCopyLink = (commentId: string) => {
    const url = `${window.location.href}#comment-${commentId}`;
    navigator.clipboard.writeText(url);
    console.log('Comment link copied');
  };

  // 🎯 NEW: Handle clicking anywhere on comment (except interactive elements)
  const handleCommentClick = (comment: Comment, event: React.MouseEvent) => {
    // Don't navigate if clicking on interactive elements
    const target = event.target as HTMLElement;
    const isInteractive = target.closest('button') || 
                          target.closest('[role="button"]') || 
                          target.closest('input') || 
                          target.closest('textarea') ||
                          target.closest('[data-interactive="true"]');
    
    if (!isInteractive && comment.timestamp >= 0) {
      console.log(`🎯 Comment clicked - navigating to timestamp: ${comment.timestamp.toFixed(3)}s`);
      onCommentClick(comment.timestamp);
    }
  };

  // 📎 ENHANCED: Handle attachment clicks with modal viewer and video pausing
  const handleAttachmentClick = (attachment: AttachmentWithType, attachmentIndex: number, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent comment navigation
    
    // 🎬 Pause video when viewing attachment
    const video = document.querySelector('video') as HTMLVideoElement;
    if (video && !video.paused) {
      video.pause();
      console.log('📹 Video paused for attachment viewing');
    }
    
    // 🆕 Open attachment in modal viewer
    setSelectedAttachment(attachment);
    setSelectedAttachmentIndex(attachmentIndex);
    setIsAttachmentViewerOpen(true);
    console.log('📎 Opening attachment viewer:', attachment);
  };

  // 🆕 Close attachment viewer
  const handleCloseAttachmentViewer = () => {
    setIsAttachmentViewerOpen(false);
    setSelectedAttachment(null);
    setSelectedAttachmentIndex(0);
  };

  return (
    <div className="h-full bg-gray-800 flex flex-col">
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <MessageSquare size={20} className="text-blue-400" />
            <h2 className="text-lg font-semibold text-white">Comments</h2>
            <span className="bg-gray-700 text-gray-300 text-xs px-2 py-1 rounded-full">
              {getTopLevelComments().length}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <CommentFilterMenu
              filters={filters}
              onFiltersChange={setFilters}
              onClearFilters={handleClearFilters}
            />
            <CommentActionsMenu
              onCopyComments={handleCopyComments}
              onPasteComments={() => console.log('Paste comments')}
              onPrintComments={() => console.log('Print comments')}
              onExportComments={handleExportComments}
            />
          </div>
        </div>

        <div className="mb-4">
          <CommentTypeFilter
            selectedType={selectedCommentType}
            onTypeChange={setSelectedCommentType}
            commentCounts={getCommentCounts()}
          />
        </div>

        <div className="flex items-center space-x-2 mb-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search comments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 pl-10"
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <CommentSortMenu
            sortBy={sortBy}
            onSortChange={setSortBy}
          />
          <div className="flex items-center space-x-2 text-gray-400">
            <Clock size={14} />
            <span>{formatTime(currentTime)}</span>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 p-6">
        <div className="space-y-4">
          {getTopLevelComments().length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <MessageSquare size={32} className="mx-auto mb-4 opacity-50" />
              <p className="text-lg">No comments found</p>
              <p className="text-sm">Try adjusting your filters or search terms</p>
            </div>
          ) : (
            getTopLevelComments().map((comment) => (
              <div key={comment.id} className="space-y-3">
                <CommentContextMenu
                  onEdit={() => handleEditComment(comment.id)}
                  onCopyLink={() => handleCopyLink(comment.id)}
                  onDelete={() => onDeleteComment(comment.id)}
                >
                  {/* 🎯 ENTIRE COMMENT IS NOW CLICKABLE */}
                  <div 
                    className="p-4 bg-gray-700 rounded-lg border border-gray-600 hover:border-gray-500 transition-all duration-200 cursor-pointer"
                    onClick={(e) => handleCommentClick(comment, e)}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        {comment.timestamp >= 0 ? (
                          <div className="flex items-center space-x-2">
                            {/* Comment number */}
                            <span className="text-xs text-gray-400 bg-gray-600 px-2 py-1 rounded-full font-medium">
                              #{comment.commentNumber}
                            </span>
                            {/* Timestamp button - prevent event bubbling */}
                            <div
                              className="flex items-center space-x-2 bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full text-sm font-medium hover:bg-yellow-500/30 transition-colors"
                              data-interactive="true"
                            >
                              <Clock size={12} />
                              <span>{formatTime(comment.timestamp)}</span>
                            </div>
                            {comment.hasDrawing && (
                              <div className="flex items-center space-x-1 bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full text-xs font-medium">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M12 19l7-7 3 3-7 7-3-3z"/>
                                  <path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
                                  <path d="m2 2 7.586 7.586"/>
                                  <circle cx="11" cy="11" r="2"/>
                                </svg>
                                <span>Drawing</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            {/* Comment number for general comments */}
                            <span className="text-xs text-gray-400 bg-gray-600 px-2 py-1 rounded-full font-medium">
                              #{comment.commentNumber || 'G'}
                            </span>
                            <div className="flex items-center space-x-2 bg-gray-600/50 text-gray-400 px-2 py-1 rounded-full text-sm font-medium">
                              <MessageSquare size={12} />
                              <span>General</span>
                            </div>
                            {comment.hasDrawing && (
                              <div className="flex items-center space-x-1 bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full text-xs font-medium">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M12 19l7-7 3 3-7 7-3-3z"/>
                                  <path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
                                  <path d="m2 2 7.586 7.586"/>
                                  <circle cx="11" cy="11" r="2"/>
                                </svg>
                                <span>Drawing</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-500">
                          {formatDate(comment.createdAt)}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteComment(comment.id);
                          }}
                          className="h-6 w-6 p-0 text-gray-400 hover:text-red-400"
                          data-interactive="true"
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </div>
                    
                    <p className="text-gray-200 mb-3 leading-relaxed">{comment.text}</p>
                    
                    {/* 📎 ENHANCED: Beautiful Clickable Attachments with Proper File Type Icons */}
                    {comment.attachments && comment.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {comment.attachments.map((attachment, index) => (
                          <button
                            key={index}
                            onClick={(e) => handleAttachmentClick(attachment, index, e)}
                            className="flex items-center space-x-2 bg-gray-600 hover:bg-blue-600/20 border border-gray-500 hover:border-blue-500/50 rounded-lg px-3 py-2 transition-all duration-200 cursor-pointer group max-w-full"
                            data-interactive="true"
                            title={`Click to preview ${attachment.name}`}
                          >
                            {getFileTypeIcon(attachment, 14)}
                            <span className="text-xs text-gray-300 group-hover:text-white truncate">
                              {truncateFileName(attachment.name)}
                            </span>
                            <Eye size={10} className="text-gray-500 group-hover:text-blue-400 flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                          <span className="text-xs text-white font-medium">
                            {comment.author.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400">{comment.author}</span>
                      </div>
                      
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setReplyingTo(comment.id);
                        }}
                        className="text-gray-400 hover:text-blue-400 text-xs"
                        data-interactive="true"
                      >
                        Reply
                      </Button>
                    </div>
                  </div>

                  {replyingTo === comment.id && (
                    <div className="ml-6 bg-gray-700 rounded-lg border border-gray-600 p-4">
                      <div className="flex items-center space-x-2 mb-3">
                        <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                          <span className="text-xs text-white font-medium">U</span>
                        </div>
                        <span className="text-sm text-gray-300">Yair Kivaiko</span>
                        <span className="text-xs text-gray-500">9m</span>
                        <div className="ml-auto flex items-center space-x-2 bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full text-xs font-medium">
                          <Clock size={10} />
                          <span>{formatTime(currentTime)}</span>
                        </div>
                      </div>
                      
                      <Textarea
                        placeholder="Leave your reply here..."
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 resize-none min-h-[80px] mb-3"
                      />
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-gray-400 hover:text-white p-2"
                          >
                            <Paperclip size={16} />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-gray-400 hover:text-white p-2"
                          >
                            <Smile size={16} />
                          </Button>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCancel}
                            className="border-gray-600 text-gray-300 hover:bg-gray-700"
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleReply(comment.id)}
                            disabled={!replyText.trim()}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            <Send size={14} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {getReplies(comment.id).map((reply) => (
                    <div 
                      key={reply.id} 
                      className="ml-6 p-3 bg-gray-750 rounded-lg border border-gray-600 cursor-pointer hover:border-gray-500 transition-colors"
                      onClick={(e) => handleCommentClick(reply, e)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        {reply.timestamp >= 0 ? (
                          <div className="flex items-center space-x-2">
                            <div
                              className="flex items-center space-x-2 bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full text-xs font-medium hover:bg-yellow-500/30 transition-colors"
                              data-interactive="true"
                            >
                              <Clock size={10} />
                              <span>{formatTime(reply.timestamp)}</span>
                            </div>
                            {reply.hasDrawing && (
                              <div className="flex items-center space-x-1 bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full text-xs font-medium">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M12 19l7-7 3 3-7 7-3-3z"/>
                                  <path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
                                  <path d="m2 2 7.586 7.586"/>
                                  <circle cx="11" cy="11" r="2"/>
                                </svg>
                                <span>Drawing</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2 bg-gray-600/50 text-gray-400 px-2 py-1 rounded-full text-xs font-medium">
                            <MessageSquare size={10} />
                            <span>General</span>
                          </div>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteComment(reply.id);
                          }}
                          className="h-5 w-5 p-0 text-gray-400 hover:text-red-400"
                          data-interactive="true"
                        >
                          <Trash2 size={10} />
                        </Button>
                      </div>
                      
                      <p className="text-gray-200 text-sm mb-2">{reply.text}</p>
                      
                      {/* 📎 ENHANCED: Clickable Attachments for Replies with Proper File Type Icons */}
                      {reply.attachments && reply.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {reply.attachments.map((attachment, index) => (
                            <button
                              key={index}
                              onClick={(e) => handleAttachmentClick(attachment, index, e)}
                              className="flex items-center space-x-1 bg-gray-600 hover:bg-blue-600/20 border border-gray-500 hover:border-blue-500/50 rounded px-2 py-1 transition-all duration-200 cursor-pointer group max-w-full"
                              data-interactive="true"
                              title={`Click to preview ${attachment.name}`}
                            >
                              {getFileTypeIcon(attachment, 10)}
                              <span className="text-xs text-gray-300 group-hover:text-white truncate">
                                {truncateFileName(attachment.name, 15)}
                              </span>
                              <Eye size={8} className="text-gray-500 group-hover:text-blue-400 flex-shrink-0" />
                            </button>
                          ))}
                        </div>
                      )}
                      
                      <div className="flex items-center space-x-2">
                        <div className="w-5 h-5 bg-green-600 rounded-full flex items-center justify-center">
                          <span className="text-xs text-white font-medium">
                            {reply.author.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400">{reply.author}</span>
                        <span className="text-xs text-gray-500">
                          {formatDate(reply.createdAt)}
                        </span>
                      </div>
                    </div>
                  ))}
                </CommentContextMenu>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
      
      {/* Comment input at the bottom */}
      <div className="border-t border-gray-700">
        <CommentInput
          currentTime={currentTime}
          onAddComment={onAddComment}
          placeholder="Leave your comment..."
          onStartDrawing={onStartDrawing}
          isDrawingMode={isDrawingMode}
        />
      </div>

      {/* 🆕 NEW: Attachment Viewer Modal */}
      <AttachmentViewer
        attachment={selectedAttachment}
        attachmentIndex={selectedAttachmentIndex}
        isOpen={isAttachmentViewerOpen}
        onClose={handleCloseAttachmentViewer}
      />
    </div>
  );
};
