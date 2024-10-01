import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MessageCircle, ArrowLeft, Send, Download, RefreshCw, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import io from 'socket.io-client';
import ImagePopup from './ImagePopup';

const API_BASE_URL = 'http://localhost:5000';
const socket = io(API_BASE_URL);

const ChatWidget = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isInitial, setIsInitial] = useState(true);
  const [threadId, setThreadId] = useState(null);
  const [isThinking, setIsThinking] = useState(false);
  const [previousChats, setPreviousChats] = useState([]);
  const [isAgentConnected, setIsAgentConnected] = useState(false);
  const [agentName, setAgentName] = useState('');
  const [chatStatus, setChatStatus] = useState('open');
  const messagesEndRef = useRef(null);
  const previousChatsRef = useRef(null);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [isFirstOpen, setIsFirstOpen] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [messageIds, setMessageIds] = useState(new Set());
  const [isInitialMessage, setIsInitialMessage] = useState(true);
  const [isLocalMessage, setIsLocalMessage] = useState(false);
  const [pendingUserMessages, setPendingUserMessages] = useState(new Set());
  const [isReopened, setIsReopened] = useState(false);
  const [showReopenedMessage, setShowReopenedMessage] = useState(false);
  const [isLiveChatActive, setIsLiveChatActive] = useState(false);
  const [showSatisfactionSurvey, setShowSatisfactionSurvey] = useState(false);
  const [satisfactionRating, setSatisfactionRating] = useState(null);

  useEffect(() => {
    fetchPreviousChats();
    
    socket.on('new_message', handleNewMessage);
    socket.on('agent_connected', handleAgentConnected);
    socket.on('chat_resolved', handleChatResolved);
    socket.on('chat_reopened', handleChatReopened);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('agent_connected', handleAgentConnected);
      socket.off('chat_resolved', handleChatResolved);
      socket.off('chat_reopened', handleChatReopened);
    };
  }, [threadId]);

  useEffect(() => {
    if (threadId) {
      socket.emit('join', { thread_id: threadId });
    }
    return () => {
      if (threadId) {
        socket.emit('leave', { thread_id: threadId });
      }
    };
  }, [threadId]);

  useEffect(() => {
    if (isOpen && isInitial && previousChatsRef.current) {
      if (isFirstOpen || !hasScrolled) {
        previousChatsRef.current.scrollTop = 0;
        setIsFirstOpen(false);
      }
    }
  }, [isOpen, isInitial, hasScrolled, isFirstOpen]);

  useEffect(() => {
    if (!isInitial && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isInitial]);

  const handleNewMessage = (data) => {
    if (data.thread_id === threadId) {
      const message = data.message;
      if (message.role === 'user') {
        setPendingUserMessages(prev => {
          const newSet = new Set(prev);
          newSet.delete(message.content);
          return newSet;
        });
      } else {
        appendMessage(message.content, message.role, message.file);
      }
      if (message.role === 'assistant' || message.role === 'agent') {
        setIsThinking(false);
      }
    }
  };

  const handleAgentConnected = (data) => {
    if (data.thread_id === threadId) {
      setIsAgentConnected(true);
      setAgentName(data.agent_name);
      setIsLiveChatActive(true);
      appendMessage(`You've been connected to ${data.agent_name}. They will respond shortly.`, 'system', null, true);
    }
  };

  const handleChatResolved = (data) => {
    if (data.thread_id === threadId) {
      setChatStatus('resolved');
      setShowSatisfactionSurvey(true);
    }
  };

  const handleChatReopened = (data) => {
    if (data.thread_id === threadId) {
      setChatStatus('open');
      setIsReopened(true);
      setShowReopenedMessage(true);
    }
  };

  const fetchPreviousChats = () => {
    fetch(`${API_BASE_URL}/get_chats`)
      .then(response => response.json())
      .then(data => setPreviousChats(data.chats.reverse()))
      .catch(error => console.error('Error fetching chats:', error));
  };

  const sendMessage = () => {
    if (input.trim() === '') return;

    if (!threadId) {
      startNewChat(input);
    } else {
      appendMessage(input, 'user');
      setPendingUserMessages(prev => new Set(prev).add(input));
      sendMessageToBackend(input);
    }

    setInput('');
    setShowReopenedMessage(false);  // Hide the reopened message when a new message is sent
  };

  const startNewChat = (message) => {
    fetch(`${API_BASE_URL}/new_thread`, {
      method: 'POST',
    })
    .then(response => response.json())
    .then(data => {
      setThreadId(data.thread_id);
      setIsInitial(false);
      setChatStatus('open');  // Ensure this line is present
      socket.emit('join', { thread_id: data.thread_id });
      appendMessage(message, 'user');
      setPendingUserMessages(new Set([message]));
      sendMessageToBackend(message, data.thread_id);
    })
    .catch(error => {
      console.error('Error starting new chat:', error);
      appendMessage("Sorry, there was an error starting a new chat.", 'system');
    });
  };

  const sendMessageToBackend = (message, chatThreadId = threadId) => {
    setIsThinking(true);

    const formData = new FormData();
    formData.append('thread_id', chatThreadId);
    formData.append('question', message);

    fetch(`${API_BASE_URL}/ask`, {
      method: 'POST',
      body: formData,
    })
    .then(response => {
      if (!response.ok) {
        return response.json().then(err => { throw err; });
      }
      return response.json();
    })
    .then(data => {
      if (data.agent_connected) {
        setIsAgentConnected(true);
      }
      setIsThinking(false);
    })
    .catch(error => {
      console.error('Error:', error);
      setIsThinking(false);
      appendMessage(error.error || "Sorry, there was an error processing your request. Please try again.", 'system');
    });
  };

  const appendMessage = (content, sender, file = null, isAgentConnectedMessage = false) => {
    setMessages(prev => {
      if (sender === 'user' && pendingUserMessages.has(content)) {
        return prev; // Don't append if it's a pending user message
      }
      const messageId = `${sender}-${content}-${Date.now()}`;
      if (!messageIds.has(messageId)) {
        setMessageIds(prevIds => new Set(prevIds).add(messageId));
        const newMessage = {
          content,
          sender,
          role: sender === 'user' ? 'User' : sender === 'assistant' ? 'Bot' : sender === 'agent' ? 'Agent' : '',
          file,
          isAgentConnectedMessage
        };
        
        setShowQuickReplies(false);
        
        return [...prev, newMessage];
      }
      return prev;
    });
  };

  const toggleChat = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setIsInitial(true);
      setMessages([]);
      setThreadId(null);
      setIsAgentConnected(false);
      setAgentName('');
      setChatStatus('open');
      // Don't reset hasScrolled here
    } else {
      // Reset when closing the chat
      setHasScrolled(false);
      setIsFirstOpen(true);
    }
  };

  const goBack = () => {
    setIsInitial(true);
    setMessages([]);
    setThreadId(null);
    setIsAgentConnected(false);
    setAgentName('');
    setChatStatus('open');
    if (threadId) {
      socket.emit('leave', { thread_id: threadId });
    }
  };

  const handleQuickReply = (action) => {
    if (action === 'helpful') {
      appendMessage("Thank you for your feedback!", 'system');
    } else if (action === 'connect') {
      connectToAgent();
    }
    setShowQuickReplies(false);
  };

  const connectToAgent = () => {
    fetch(`${API_BASE_URL}/connect_agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ thread_id: threadId }),
    })
    .then(response => response.json())
    .then(data => {
      if (!data.success) {
        throw new Error('Failed to connect to agent');
      }
    })
    .catch(error => {
      console.error('Error connecting to agent:', error);
      appendMessage("Sorry, there was an error connecting you to an agent.", 'system');
    });
  };

  const reopenChat = () => {
    fetch(`${API_BASE_URL}/reopen_chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ thread_id: threadId }),
    })
    .then(response => response.json())
    .then(data => {
      if (!data.success) {
        throw new Error('Failed to reopen chat');
      }
      setChatStatus('open');
      setIsReopened(true);
      setShowReopenedMessage(true);
    })
    .catch(error => {
      console.error('Error reopening chat:', error);
      appendMessage("Sorry, there was an error reopening the chat.", 'system');
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const selectChat = (selectedThreadId, status, wasReopened) => {
    setThreadId(selectedThreadId);
    setIsInitial(false);
    setChatStatus(status);
    setIsReopened(wasReopened);
    setShowReopenedMessage(wasReopened);
    fetch(`${API_BASE_URL}/get_chat_messages/${selectedThreadId}`)
      .then(response => response.json())
      .then(data => {
        setMessages(data.messages.map(msg => ({
          ...msg,
          role: msg.role === 'user' ? 'User' : msg.role === 'assistant' ? 'Bot' : msg.role === 'agent' ? 'Agent' : '',
          sender: msg.role
        })));
        // Add this check to display the agent connection message when reopening a chat
        const agentMessage = data.messages.find(msg => msg.isAgentConnectedMessage);
        if (agentMessage) {
          appendMessage(agentMessage.content, 'system', null, true);
        }
      })
      .catch(error => console.error('Error fetching chat messages:', error));
    socket.emit('join', { thread_id: selectedThreadId });
  };

  const handleScroll = () => {
    if (previousChatsRef.current && previousChatsRef.current.scrollTop > 0) {
      setHasScrolled(true);
    }
  };

  const handleImageClick = useCallback((imageUrl) => {
    setSelectedImage(imageUrl);
  }, []);

  const closeImagePopup = useCallback(() => {
    setSelectedImage(null);
  }, []);

  const submitSatisfactionSurvey = (rating) => {
    setSatisfactionRating(rating);
    // You can send this rating to the backend if needed
    setShowSatisfactionSurvey(false);
  };

  const sortedPreviousChats = useMemo(() => {
    return previousChats.sort((a, b) => {
      // Sort by status (in_progress first)
      if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
      if (a.status !== 'in_progress' && b.status === 'in_progress') return 1;
      
      // Then sort by last activity (most recent first)
      return new Date(b.last_activity) - new Date(a.last_activity);
    });
  }, [previousChats]);

  return (
    <div className="fixed bottom-4 right-4 font-sans text-black">
      {!isOpen && (
        <button
          onClick={toggleChat}
          className="bg-[#4A90E2] hover:bg-[#3A7BC8] text-white rounded-full p-3 shadow-lg transition-colors"
        >
          <MessageCircle size={24} />
        </button>
      )}
      {isOpen && (
        <div className="bg-white rounded-lg shadow-xl w-[440px] h-[90vh] flex flex-col">
          <div className="bg-[#4A90E2] text-white p-4 rounded-t-lg flex justify-between items-center">
            {!isInitial && (
              <button onClick={goBack} className="text-white hover:text-blue-200 transition-colors">
                <ArrowLeft size={20} />
              </button>
            )}
            <h3 className="font-bold text-lg flex-grow text-center">
              {isInitial ? "How can I help you?" : "Customer Support"}
            </h3>
            <button onClick={toggleChat} className="text-white hover:text-blue-200 transition-colors">
              <X size={20} />
            </button>
          </div>
          <div 
            className="flex-1 overflow-y-auto p-4 bg-gray-50" 
            ref={previousChatsRef}
            onScroll={handleScroll}
          >
            {isInitial ? (
              <>
                <div className="mb-4">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your query here..."
                    className="w-full p-3 border rounded-lg text-base resize-none focus:ring-2 focus:ring-[#4A90E2] focus:border-transparent"
                    rows="4"
                  />
                  <button
                    onClick={sendMessage}
                    className="bg-[#4A90E2] hover:bg-[#3A7BC8] text-white rounded-lg p-2 mt-2 w-full transition-colors"
                  >
                    Send
                  </button>
                </div>
                <h2 className="text-xl font-bold mb-4">Previous Queries</h2>
                <div className="space-y-3">
                  {sortedPreviousChats.map((chat, index) => (
                    <div 
                      key={chat.thread_id} 
                      className="bg-white p-4 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors shadow-sm"
                      onClick={() => selectChat(chat.thread_id, chat.status, chat.was_reopened)}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-[#2C3E50]">Query #{index + 1}</span>
                        <div className="flex items-center space-x-2">
                          {chat.was_reopened && (
                            <span className="px-2 py-1 rounded-full text-xs bg-orange-500 text-white">
                              Reopened
                            </span>
                          )}
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            chat.status === 'in_progress' ? 'bg-green-500 text-white' : 
                            chat.status === 'resolved' ? 'bg-gray-500 text-white' : 
                            'bg-green-500 text-white'
                          }`}>
                            {chat.status === 'in_progress' ? 'In Progress' : chat.status}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mt-2 truncate">{chat.last_message}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                {isLiveChatActive && (
                  <div className="text-center text-sm text-yellow-800 mb-2 bg-[#FFF9C4] p-3 rounded-lg border border-[#FFC107] shadow-sm">
                    <strong>Live Chat Active:</strong> You are currently in a live chat with {agentName}.
                  </div>
                )}
                {messages.map((message, index) => (
                  <div key={index} className={`mb-4 ${message.sender === 'user' ? 'text-right' : 'text-left'}`}>
                    {message.isAgentConnectedMessage ? (
                      <div className="text-center text-sm text-gray-700 mb-2 bg-[#FFF9C4] p-3 rounded-lg border border-[#FFC107] shadow-sm">
                        <strong>Agent Connected:</strong> {message.content}
                      </div>
                    ) : (
                      <div className={`inline-block p-3 rounded-lg max-w-[80%] ${
                        message.sender === 'user' ? 'bg-[#DBE9FE] text-[#1A365D]' : 'bg-[#F0F4F8] text-[#2C3E50]'
                      } text-sm text-left`}>
                        <div className="font-semibold mb-1">
                          {message.sender === 'user' ? 'User' : message.role}
                        </div>
                        <ReactMarkdown 
                          children={message.content || ''}
                          remarkPlugins={[remarkGfm]}
                          components={{
                            img: ({node, ...props}) => (
                              <img 
                                {...props} 
                                className="max-w-full h-auto cursor-pointer my-4" 
                                onClick={() => handleImageClick(props.src)} 
                                alt={props.alt || ''}
                              />
                            ),
                            strong: ({node, ...props}) => <strong {...props} />,
                            p: ({node, ...props}) => <p {...props} className="mb-2" />,
                            ol: ({node, ...props}) => <ol {...props} className="list-decimal list-inside mb-2" />,
                            ul: ({node, ...props}) => <ul {...props} className="list-disc list-inside mb-2" />,
                            li: ({node, ...props}) => <li {...props} className="mb-1" />,
                          }}
                        />
                        {message.file && (
                          <div className="mt-4 mb-2">
                            {message.file.endsWith('.jpg') || message.file.endsWith('.png') || message.file.endsWith('.gif') ? (
                              <img
                                src={message.file}
                                alt="Attachment"
                                className="max-w-full h-auto cursor-pointer"
                                onClick={() => handleImageClick(message.file)}
                              />
                            ) : (
                              <a href={message.file} download className="text-[#4A90E2] underline flex items-center">
                                <Download size={14} className="mr-1" />
                                Download attachment
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {!isAgentConnected && isThinking && (
                  <div className="text-left mb-2">
                    <span className="inline-block p-2 rounded-lg bg-[#F0F4F8] text-[#2C3E50] text-sm">
                      Thinking...
                    </span>
                  </div>
                )}
              </>
            )}
            {!isInitial && <div ref={messagesEndRef} />}
          </div>
          {!isInitial && (
            <div className="p-4 border-t bg-white">
              {chatStatus === 'resolved' && (
                <div className="mb-2">
                  {showSatisfactionSurvey ? (
                    <div className="text-center">
                      <p className="mb-2">How satisfied are you with the resolution?</p>
                      <div className="flex justify-center space-x-2">
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <button
                            key={rating}
                            onClick={() => submitSatisfactionSurvey(rating)}
                            className="bg-[#4A90E2] hover:bg-[#3A7BC8] text-white rounded-full w-8 h-8 flex items-center justify-center transition-colors"
                          >
                            {rating}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={reopenChat}
                      className="bg-[#4CAF50] hover:bg-[#45a049] text-white rounded-lg p-2 w-full flex items-center justify-center transition-colors"
                    >
                      <RefreshCw size={18} className="mr-2" />
                      Reopen Chat
                    </button>
                  )}
                </div>
              )}
              {(chatStatus === 'open' || chatStatus === 'in_progress' || !chatStatus) && (
                <>
                  {showReopenedMessage && (
                    <div className="mb-2 text-center text-sm text-yellow-600 bg-yellow-100 p-2 rounded-lg">
                      This chat has been reopened
                    </div>
                  )}
                  {showQuickReplies && (
                    <div className="mb-2 flex justify-center space-x-2">
                      <button
                        onClick={() => handleQuickReply('helpful')}
                        className="bg-[#4CAF50] hover:bg-[#45a049] text-white rounded-lg p-2 text-sm transition-colors"
                      >
                        This was helpful👍
                      </button>
                      <button
                        onClick={() => handleQuickReply('connect')}
                        className="bg-[#FF9800] hover:bg-[#F57C00] text-white rounded-lg p-2 text-sm transition-colors"
                      >
                        Connect to agent
                      </button>
                    </div>
                  )}
                  <div className="flex items-center bg-[#F5F7FA] rounded-lg">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Type your message..."
                      className="flex-grow p-3 bg-transparent text-[#333333] text-sm focus:outline-none"
                    />
                    <button
                      onClick={sendMessage}
                      className="bg-[#4A90E2] hover:bg-[#3A7BC8] text-white rounded-lg p-2 m-1 transition-colors"
                    >
                      <Send size={18} />
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
      {selectedImage && (
        <ImagePopup 
          imageUrl={selectedImage} 
          onClose={closeImagePopup} 
        />
      )}
    </div>
  );
};

export default ChatWidget;