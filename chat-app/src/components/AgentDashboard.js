import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import io from 'socket.io-client';
import { Send, CheckCircle, User, Bot, MessageCircle, Filter, Download, Shield, X } from 'lucide-react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import ImagePopup from './ImagePopup';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE_URL = 'http://localhost:5000';
const socket = io(API_BASE_URL);

const ChatMessages = React.memo(({ messages, handleImageClick }) => {
  const messagesEndRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  return (
    <div className="flex-grow overflow-y-auto p-4 bg-gray-50 space-y-4">
      {messages.map((msg, index) => (
        <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div className={`inline-block p-3 rounded-lg max-w-[70%] shadow-sm ${msg.role === 'user' ? 'bg-blue-100 text-blue-800' :
            msg.role === 'system' ? 'bg-gray-200 text-gray-800' :
              msg.role === 'assistant' ? 'bg-purple-100 text-purple-800' :
                msg.role === 'agent' ? 'bg-green-100 text-green-800' :
                  'bg-yellow-100 text-yellow-800'
            }`}>
            <div className="font-semibold mb-1 flex items-center text-sm">
              {msg.role === 'user' ? <User size={14} className="mr-1" /> :
                msg.role === 'assistant' ? <Bot size={14} className="mr-1" /> :
                  msg.role === 'agent' ? <User size={14} className="mr-1" /> :
                    <Shield size={14} className="mr-1" />}
              {msg.role.charAt(0).toUpperCase() + msg.role.slice(1)}
            </div>
            <div className="text-sm" dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(marked.parse(msg.content || ''))
            }} />
            {msg.file && (
              <div className="mt-4 mb-2">
                {msg.file.endsWith('.jpg') || msg.file.endsWith('.png') || msg.file.endsWith('.gif') ? (
                  <img
                    src={msg.file}
                    alt="Attachment"
                    className="max-w-full h-auto cursor-pointer"
                    onClick={() => handleImageClick(msg.file)}
                  />
                ) : (
                  <a href={msg.file} download className="text-[#4A90E2] underline flex items-center">
                    <Download size={14} className="mr-1" />
                    Download attachment
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
});

const ChatItem = React.memo(({ chat, onClick, isSelected }) => (
  <div
    className={`p-4 cursor-pointer hover:bg-indigo-50 transition-colors ${isSelected ? 'bg-indigo-100' : ''} border-b`}
    onClick={() => onClick(chat)}
  >
    <div className="flex justify-between items-center mb-2">
      <span className="font-semibold text-indigo-700">Chat {chat.thread_id.slice(0, 8)}...</span>
      <div className="flex space-x-2">
        <span className={`px-2 py-1 rounded-full text-xs ${chat.status === 'in_progress' ? 'bg-green-500 text-white' :
          chat.status === 'resolved' ? 'bg-gray-500 text-white' :
            'bg-green-500 text-white'
          }`}>
          {chat.status === 'in_progress' ? 'In Progress' : chat.status}
        </span>
        {chat.was_reopened && (
          <span className="px-2 py-1 rounded-full text-xs bg-orange-500 text-white">
            Reopened
          </span>
        )}
      </div>
    </div>
    <div className="text-sm text-gray-600 truncate">
      {chat.messages[chat.messages.length - 1]?.content || 'No messages'}
    </div>
  </div>
));

const ResolveForm = ({ onSubmit, onCancel }) => {
  const [queryType, setQueryType] = useState('');
  const [category, setCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');

  const queryTypes = ['Query', 'Problem', 'Feature Request'];
  const categories = [
    'Financial Reports', 'Resident App', 'Accounts', 'Amenities', 'Service Provider and Reports',
    'Visitor Management Reports', 'Blank Chats', 'Manage Flats', 'Communications', 'Resident Management',
    'Manage Admins and Roles', 'Admin dashboard settings', 'Parking and Vehicle Management',
    'Help Desk', 'Security and Guard Patrolling', 'Assets & Inventory', 'Tasks', 'Guard App',
    'Utility Meter', 'MyGate Club', 'Emergency Contacts'
  ];
  const subCategories = [
    'Dues And Advance Reports', 'General', 'Dues and Receipts', 'Service Provider',
    'Notification Troubleshooting', 'Unspecified Query', 'Group Email', 'Penalty Settings',
    'Move in Move Out', 'Invoicing', 'Bank Accounts', 'Flat Registration',
    'Resident and Visitor Management Settings', 'RM Connect and details', 'Dues and Online Payments',
    'Final Account', 'Maintenance and Accounting Settings', 'Voucher', 'Emergency Contacts',
    'Delivery Report', 'Attendance', 'Notice board', 'Tenant Management', 'Purchasing',
    'Financial Year', 'Documents', 'Guard Patrolling', 'Advertisements', 'Discussion forum',
    'Income and Expense', 'Login and Signup', 'Polls and Surveys', 'User groups', 'Chart of Accounts',
    'Ledgers', 'Tax Reports', 'Handling Charges', 'Profile Updation', 'Meetings', 'Audit Logs',
    'Pre Approval', 'Household', 'Validated Entries', 'Troubleshooting', 'Budget', 'MyGate Homes',
    'Account Balance and Statements', 'GDPR', 'Resident Directory', 'Help Desk', 'Invoice Sequence'
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ queryType, category, subCategory });
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-white border-t">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Query Type</label>
          <select
            value={queryType}
            onChange={(e) => setQueryType(e.target.value)}
            className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            required
          >
            <option value="">Select Query Type</option>
            {queryTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            required
          >
            <option value="">Select Category</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">SubCategory</label>
          <select
            value={subCategory}
            onChange={(e) => setSubCategory(e.target.value)}
            className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            required
          >
            <option value="">Select SubCategory</option>
            {subCategories.map((subCat) => (
              <option key={subCat} value={subCat}>{subCat}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-4 flex justify-end space-x-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors text-sm"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
        >
          Resolve
        </button>
      </div>
    </form>
  );
};

const ChatHeader = React.memo(({ chat, onResolve, onViewSocietyDetails, showSocietyDetails, email, handleToggle, isToggled }) => (
  <div className="bg-indigo-600 text-white p-4 flex justify-between items-center">
    <h3 className="text-lg font-semibold">Chat {chat.thread_id.slice(0, 8)}...</h3>
    <span className="font-semibold text-white">Email: {email}</span>

    <div className="flex space-x-2">


      {chat.status === 'in_progress' && (
        <button
          onClick={onResolve}
          className="bg-green-500 hover:bg-green-600 text-white rounded-lg px-4 py-2 flex items-center transition-colors text-sm"
        >
          <CheckCircle size={18} className="mr-2" />
          Resolve
        </button>
      )}
      <button
        onClick={onViewSocietyDetails}
        className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-4 py-2 flex items-center transition-colors text-sm"
      >
        {showSocietyDetails ? 'Hide' : 'View'} Society Details
      </button>

    </div>
  </div>
));

const ResolvePopup = ({ onSubmit, onCancel }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      className="bg-white rounded-lg p-6 w-full max-w-md"
    >
      <h2 className="text-xl font-bold mb-4">Resolve Ticket</h2>
      <ResolveForm onSubmit={onSubmit} onCancel={onCancel} />
    </motion.div>
  </div>
);

const AgentDashboard = ({ email }) => {
  const [agentChats, setAgentChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [message, setMessage] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isResolving, setIsResolving] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isToggled, setIsToggled] = useState(true);
  const [agentThreads, setAgentThreads] = useState(null);
  const [showSocietyDetails, setShowSocietyDetails] = useState(false);
  const [isResolvingPopup, setIsResolvingPopup] = useState(false);

  const fetchAgentChats = useCallback(() => {
    fetch(`${API_BASE_URL}/get_agent_chats`)
      .then(response => response.json())
      .then(data => {
        setAgentChats(prevChats => {
          const updatedChats = data.chats.map(newChat => {
            const existingChat = prevChats.find(chat => chat.thread_id === newChat.thread_id);
            return existingChat ? { ...existingChat, ...newChat } : newChat;
          });
          return updatedChats;
        });

        setSelectedChat(prevSelectedChat => {
          if (prevSelectedChat) {
            const updatedSelectedChat = data.chats.find(chat => chat.thread_id === prevSelectedChat.thread_id);
            return updatedSelectedChat || prevSelectedChat;
          }
          return prevSelectedChat;
        });
      })
      .catch(error => console.error('Error fetching agent chats:', error));
  }, []);

  useEffect(() => {
    fetchAgentChats();

    const handleNewMessage = (data) => {
      setAgentChats(prevChats =>
        prevChats.map(chat =>
          chat.thread_id === data.thread_id
            ? { ...chat, messages: [...chat.messages, data.message], last_activity: new Date().toISOString() }
            : chat
        )
      );

      setSelectedChat(prevSelectedChat => {
        if (prevSelectedChat && prevSelectedChat.thread_id === data.thread_id) {
          return {
            ...prevSelectedChat,
            messages: [...prevSelectedChat.messages, data.message],
          };
        }
        return prevSelectedChat;
      });
    };

    const handleChatResolved = (data) => {
      updateChatStatus(data.thread_id, 'resolved');
    };

    const handleChatReopened = (data) => {
      updateChatStatus(data.thread_id, 'in_progress');
    };

    const handleAgentRequired = () => {
      fetchAgentChats();

      socket.emit("get_active_agents", { email: email });
    };

    socket.on('new_message', handleNewMessage);
    socket.on('chat_resolved', handleChatResolved);
    socket.on('chat_reopened', handleChatReopened);
    socket.on('agent_required', handleAgentRequired);
    socket.on('agent_connecter', (data) => {
      console.log('Agent connected', data);
    });

    socket.on('active_agents', (agents) => {

      console.log('Active agents', agents);

      for (let i = 0; i < agents.length; i++) {
        if (agents[i].email === email) {
          setAgentThreads(agents[i].thread_ids);
          break;
        }
      }
    });

    const interval = setInterval(fetchAgentChats, 5000);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('chat_resolved', handleChatResolved);
      socket.off('chat_reopened', handleChatReopened);
      socket.off('agent_required', handleAgentRequired);
      socket.off('agent_connecter');
      socket.off('active_agents');
      clearInterval(interval);
    };
  }, [fetchAgentChats]);

  const switchAgent = (email, thread_id) => {
    socket.emit("agent_connecter", { email: email, thread_id: thread_id });
  }

  const agentOnline = useCallback(() => {
    socket.emit('agents_online', { email: email });
    toast.success('Agent is online now');
  }, []);

  const agentOffline = () => {
    socket.emit('agents_offline', { email: email });
    toast.success('Agent is offline now');
  };


  useEffect(() => {
    if (selectedChat) {
      socket.emit('join', { thread_id: selectedChat.thread_id, agent: true, email: email });
    }

    return () => {
      if (selectedChat) {
        socket.emit('leave', { thread_id: selectedChat.thread_id });
      }
    };
  }, [selectedChat]);

  const updateChatStatus = useCallback((threadId, status) => {
    setAgentChats(prevChats =>
      prevChats.map(chat =>
        chat.thread_id === threadId
          ? { ...chat, status: status }
          : chat
      )
    );

    setSelectedChat(prev =>
      prev && prev.thread_id === threadId ? { ...prev, status: status } : prev
    );
  }, []);

  const selectChat = useCallback((chat) => {
    setSelectedChat(chat);
  }, []);

  const sendMessage = useCallback(() => {
    if (!message.trim() || !selectedChat) return;

    const formData = new FormData();
    formData.append('thread_id', selectedChat.thread_id);
    formData.append('message', message);

    fetch(`${API_BASE_URL}/send_agent_message`, {
      method: 'POST',
      body: formData,
    })
      .then(response => response.json())
      .then(() => {
        setMessage('');
      })
      .catch(error => console.error('Error sending message:', error));
  }, [message, selectedChat]);

  const resolveChat = useCallback((resolutionData) => {
    if (!selectedChat) return;

    fetch(`${API_BASE_URL}/resolve_chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        thread_id: selectedChat.thread_id,
        ...resolutionData
      }),
    })
      .then(response => response.json())
      .then(() => {
        console.log('Chat resolved successfully');
        setIsResolving(false);
        // Update local state to reflect resolved status
        updateChatStatus(selectedChat.thread_id, 'resolved');
      })
      .catch(error => {
        console.error('Error resolving chat:', error);
        setIsResolving(false);
      });
  }, [selectedChat, updateChatStatus]);

  const handleResolveClick = () => {
    setIsResolvingPopup(true);
  };

  const handleResolutionCancel = () => {
    setIsResolvingPopup(false);
  };

  const handleResolutionSubmit = (resolutionData) => {
    resolveChat(resolutionData);
    setIsResolvingPopup(false);
  };

  const sortedChats = useMemo(() => {
    return agentChats.sort((a, b) => {
      // Sort by status (open first)
      if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
      if (a.status !== 'in_progress' && b.status === 'in_progress') return 1;

      // Then sort by last activity
      return new Date(b.last_activity) - new Date(a.last_activity);
    });

  }, [agentChats]);

  const filteredChats = useMemo(() => {
    const chats = agentThreads ? sortedChats.filter(chat => agentThreads.includes(chat.thread_id)) : sortedChats;

    return chats.filter(chat =>
      statusFilter === 'all' ||
      chat.status === statusFilter ||
      (statusFilter === 'reopened' && chat.was_reopened)
    );
  }, [sortedChats, statusFilter]);

  const handleImageClick = useCallback((imageUrl) => {
    console.log('Image clicked:', imageUrl);
    setSelectedImage(imageUrl);
  }, []);

  const closeImagePopup = () => {
    setSelectedImage(null);
  };

  const toggleSocietyDetails = () => {
    setShowSocietyDetails(prev => !prev);
  };

  const handleToggle = () => {
    if (isToggled) {
      agentOffline();
    } else {
      agentOnline();
    }
    setIsToggled(!isToggled);
  }

  useEffect(() => {

    socket.emit('agents_online', { email: email });

  }, []);

  return (
    <div className="flex h-screen bg-gray-100 p-4 gap-4 font-sans">
      <div className="w-80 flex-shrink-0 bg-white rounded-lg shadow-md overflow-hidden flex flex-col">
        <div className="text-xl flex items-center justify-between font-bold p-4 bg-indigo-600 text-white">Agent Inbox
          <label htmlFor="toggleB" className="flex items-center cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                id="toggleB"
                className="sr-only"
                checked={isToggled}
                onChange={handleToggle} // Toggle on checkbox change
              />
              <div className={`block w-14 h-8 rounded-full bg-gray-600`}></div>
              <div
                className={`dot absolute left-1 top-1 ${!isToggled ? "bg-white" : "transform translate-x-6 bg-green-500"} w-6 h-6 rounded-full transition`}
              ></div>
            </div>
          </label>
        </div>
        <div className="p-4 border-b bg-gray-50">
          <div className="flex items-center mb-2">
            <Filter size={18} className="text-gray-400 mr-2" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            >
              <option value="all">All</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="reopened">Reopened</option>
            </select>
          </div>
        </div>
        <div className="overflow-y-auto flex-grow">
          {filteredChats.map(chat => (
            <ChatItem
              key={chat.thread_id}
              chat={chat}
              onClick={selectChat}
              isSelected={selectedChat?.thread_id === chat.thread_id}
            />
          ))}
        </div>
      </div>
      <div className="flex-grow flex">
        <div className={`bg-white rounded-lg shadow-md overflow-hidden flex flex-col ${showSocietyDetails ? 'w-2/3' : 'w-full'}`}>
          {selectedChat ? (
            <>
              <ChatHeader
                chat={selectedChat}
                onResolve={handleResolveClick}
                onViewSocietyDetails={toggleSocietyDetails}
                showSocietyDetails={showSocietyDetails}
                email={email}
                handleToggle={handleToggle}
                isToggled={isToggled}
              />
              {isResolving ? (
                <ResolveForm onSubmit={resolveChat} onCancel={handleResolutionCancel} />
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                    {selectedChat.messages.map((message, index) => (
                      <div key={index} className={`mb-4 ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
                        <div className={`inline-block p-3 rounded-lg max-w-[80%] ${message.role === 'user' ? 'bg-blue-100 text-blue-800' :
                          message.role === 'assistant' ? 'bg-purple-100 text-purple-800' :
                            message.role === 'agent' ? 'bg-green-100 text-green-800' :
                              'bg-gray-200 text-gray-800'
                          } text-sm text-left`}>
                          <div className="font-semibold mb-1 flex items-center">
                            {message.role === 'user' && <User size={14} className="mr-1" />}
                            {message.role === 'assistant' && <Bot size={14} className="mr-1" />}
                            {message.role === 'agent' && <User size={14} className="mr-1" />}
                            {message.role === 'system' && <Shield size={14} className="mr-1" />}
                            {message.role.charAt(0).toUpperCase() + message.role.slice(1)}
                          </div>
                          <ReactMarkdown
                            children={message.content || ''}
                            remarkPlugins={[remarkGfm]}
                            components={{
                              img: ({ node, ...props }) => (
                                <img
                                  {...props}
                                  className="max-w-full h-auto cursor-pointer my-4"
                                  onClick={() => handleImageClick(props.src)}
                                  alt={props.alt}
                                />
                              ),
                              strong: ({ node, ...props }) => <strong {...props} />,
                              p: ({ node, ...props }) => <p {...props} className="mb-2" />,
                              ol: ({ node, ...props }) => <ol {...props} className="list-decimal list-inside mb-2" />,
                              ul: ({ node, ...props }) => <ul {...props} className="list-disc list-inside mb-2" />,
                              li: ({ node, ...props }) => <li {...props} className="mb-1" />,
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
                      </div>
                    ))}
                  </div>
                  {selectedChat.status === 'in_progress' && (
                    <div className="p-4 bg-gray-50 border-t">
                      <div className="flex items-center">
                        <input
                          type="text"
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              sendMessage();
                            }
                          }}
                          placeholder="Type your message..."
                          className="flex-grow p-2 border rounded-l-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        />
                        <button
                          onClick={sendMessage}
                          className="bg-indigo-500 hover:bg-indigo-600 text-white rounded-r-lg p-2 transition-colors"
                        >
                          <Send size={18} />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <p className="text-lg">Select a chat to start messaging</p>
            </div>
          )}
        </div>
        <AnimatePresence>
          {showSocietyDetails && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: '33.333%', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="bg-white rounded-lg shadow-md ml-4 p-4 relative overflow-hidden"
            >
              <button
                onClick={toggleSocietyDetails}
                className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
              <h3 className="text-lg font-semibold mb-4">Society Details</h3>
              <p className="text-gray-600">Society details will come here.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {isResolvingPopup && (
          <ResolvePopup
            onSubmit={handleResolutionSubmit}
            onCancel={handleResolutionCancel}
          />
        )}
      </AnimatePresence>
      {selectedImage && (
        <ImagePopup
          imageUrl={selectedImage}
          onClose={closeImagePopup}
        />
      )}
    </div>
  );
};

export default AgentDashboard;