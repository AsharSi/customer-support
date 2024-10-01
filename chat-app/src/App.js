import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import ChatWidget from './components/ChatWidget';
import AgentDashboard from './components/AgentDashboard';
import Agent from './components/Agent';
import { Toaster } from 'react-hot-toast';

function App() {
  return (
    <Router>
         <Toaster />
      <div className="App">
        <Routes>
          <Route path="/" element={
            <div className="relative min-h-screen bg-black text-white">
              <h1 className="text-3xl font-bold text-center py-8">Welcome to Customer Support</h1>
              <p className="text-center mb-8">Click the chat icon in the bottom right to get started!</p>
              <ChatWidget />
            </div>
          } />
          <Route path="/agent" element={<Agent />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;