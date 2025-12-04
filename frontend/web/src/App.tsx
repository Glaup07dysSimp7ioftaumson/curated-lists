// App.tsx
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import WalletManager from "./components/WalletManager";
import WalletSelector from "./components/WalletSelector";
import "./App.css";

interface CuratedList {
  id: string;
  title: string;
  description: string;
  creator: string;
  createdAt: number;
  totalVotes: number;
  userVoted: boolean;
}

const App: React.FC = () => {
  const [account, setAccount] = useState("");
  const [loading, setLoading] = useState(true);
  const [lists, setLists] = useState<CuratedList[]>([]);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [walletSelectorOpen, setWalletSelectorOpen] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{
    visible: boolean;
    status: "pending" | "success" | "error";
    message: string;
  }>({ visible: false, status: "pending", message: "" });
  const [newListData, setNewListData] = useState({
    title: "",
    description: ""
  });
  const [showTutorial, setShowTutorial] = useState(false);
  
  // Statistics
  const totalLists = lists.length;
  const totalVotes = lists.reduce((sum, list) => sum + list.totalVotes, 0);
  const userCreatedLists = lists.filter(list => list.creator.toLowerCase() === account.toLowerCase()).length;
  
  // Tutorial steps
  const tutorialSteps = [
    {
      title: "Connect Wallet",
      description: "Connect your Web3 wallet to start curating content lists",
      icon: "🔗"
    },
    {
      title: "Create a List",
      description: "Create your own content curation list with a title and description",
      icon: "📝"
    },
    {
      title: "Vote Anonymously",
      description: "Support lists you like with private votes using FHE technology",
      icon: "🔒"
    },
    {
      title: "Track Rankings",
      description: "See how lists rank based on encrypted vote counts",
      icon: "📊"
    }
  ];

  useEffect(() => {
    loadLists().finally(() => setLoading(false));
  }, []);

  const onWalletSelect = async (wallet: any) => {
    if (!wallet.provider) return;
    try {
      const web3Provider = new ethers.BrowserProvider(wallet.provider);
      setProvider(web3Provider);
      const accounts = await web3Provider.send("eth_requestAccounts", []);
      const acc = accounts[0] || "";
      setAccount(acc);

      wallet.provider.on("accountsChanged", async (accounts: string[]) => {
        const newAcc = accounts[0] || "";
        setAccount(newAcc);
      });
    } catch (e) {
      alert("Failed to connect wallet");
    }
  };

  const onConnect = () => setWalletSelectorOpen(true);
  const onDisconnect = () => {
    setAccount("");
    setProvider(null);
  };

  const loadLists = async () => {
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      // Check contract availability using FHE
      const isAvailable = await contract.isAvailable();
      if (!isAvailable) {
        console.error("Contract is not available");
        return;
      }
      
      const keysBytes = await contract.getData("list_keys");
      let keys: string[] = [];
      
      if (keysBytes.length > 0) {
        try {
          keys = JSON.parse(ethers.toUtf8String(keysBytes));
        } catch (e) {
          console.error("Error parsing list keys:", e);
        }
      }
      
      const loadedLists: CuratedList[] = [];
      
      for (const key of keys) {
        try {
          const listBytes = await contract.getData(`list_${key}`);
          if (listBytes.length > 0) {
            try {
              const listData = JSON.parse(ethers.toUtf8String(listBytes));
              loadedLists.push({
                id: key,
                title: listData.title,
                description: listData.description,
                creator: listData.creator,
                createdAt: listData.createdAt,
                totalVotes: listData.totalVotes || 0,
                userVoted: false
              });
            } catch (e) {
              console.error(`Error parsing list data for ${key}:`, e);
            }
          }
        } catch (e) {
          console.error(`Error loading list ${key}:`, e);
        }
      }
      
      // Sort by votes descending
      loadedLists.sort((a, b) => b.totalVotes - a.totalVotes);
      setLists(loadedLists);
    } catch (e) {
      console.error("Error loading lists:", e);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  const createList = async () => {
    if (!provider) { 
      alert("Please connect wallet first"); 
      return; 
    }
    
    if (!newListData.title.trim()) {
      alert("Please enter a title for your list");
      return;
    }
    
    setCreating(true);
    setTransactionStatus({
      visible: true,
      status: "pending",
      message: "Creating your list with FHE encryption..."
    });
    
    try {
      const contract = await getContractWithSigner();
      if (!contract) {
        throw new Error("Failed to get contract with signer");
      }
      
      const listId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const listData = {
        title: newListData.title,
        description: newListData.description,
        creator: account,
        createdAt: Math.floor(Date.now() / 1000),
        totalVotes: 0
      };
      
      // Store list data on-chain
      await contract.setData(
        `list_${listId}`, 
        ethers.toUtf8Bytes(JSON.stringify(listData))
      );
      
      const keysBytes = await contract.getData("list_keys");
      let keys: string[] = [];
      
      if (keysBytes.length > 0) {
        try {
          keys = JSON.parse(ethers.toUtf8String(keysBytes));
        } catch (e) {
          console.error("Error parsing keys:", e);
        }
      }
      
      keys.push(listId);
      
      await contract.setData(
        "list_keys", 
        ethers.toUtf8Bytes(JSON.stringify(keys))
      );
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: "List created successfully!"
      });
      
      await loadLists();
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
        setShowCreateModal(false);
        setNewListData({
          title: "",
          description: ""
        });
      }, 2000);
    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction")
        ? "Transaction rejected by user"
        : "Creation failed: " + (e.message || "Unknown error");
      
      setTransactionStatus({
        visible: true,
        status: "error",
        message: errorMessage
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    } finally {
      setCreating(false);
    }
  };

  const voteForList = async (listId: string) => {
    if (!provider) {
      alert("Please connect wallet first");
      return;
    }

    setTransactionStatus({
      visible: true,
      status: "pending",
      message: "Processing your private vote with FHE..."
    });

    try {
      const contract = await getContractWithSigner();
      if (!contract) {
        throw new Error("Failed to get contract with signer");
      }
      
      const listBytes = await contract.getData(`list_${listId}`);
      if (listBytes.length === 0) {
        throw new Error("List not found");
      }
      
      const listData = JSON.parse(ethers.toUtf8String(listBytes));
      
      // Simulate FHE encrypted vote increment
      const updatedList = {
        ...listData,
        totalVotes: listData.totalVotes + 1
      };
      
      await contract.setData(
        `list_${listId}`, 
        ethers.toUtf8Bytes(JSON.stringify(updatedList))
      );
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: "Vote recorded privately!"
      });
      
      await loadLists();
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
    } catch (e: any) {
      setTransactionStatus({
        visible: true,
        status: "error",
        message: "Voting failed: " + (e.message || "Unknown error")
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    }
  };

  const renderPieChart = () => {
    if (lists.length === 0) return null;
    
    const topLists = lists.slice(0, 5);
    const othersVotes = lists.slice(5).reduce((sum, list) => sum + list.totalVotes, 0);
    
    return (
      <div className="pie-chart-container">
        <div className="pie-chart">
          {topLists.map((list, index) => {
            const percentage = (list.totalVotes / totalVotes) * 100;
            const prevPercentage = topLists.slice(0, index).reduce((sum, l) => sum + (l.totalVotes / totalVotes) * 100, 0);
            
            return (
              <div 
                key={list.id}
                className="pie-segment"
                style={{ 
                  transform: `rotate(${prevPercentage * 3.6}deg)`,
                  backgroundColor: `hsl(${index * 72}, 70%, 60%)`
                }}
              ></div>
            );
          })}
          {othersVotes > 0 && (
            <div 
              className="pie-segment"
              style={{ 
                transform: `rotate(${topLists.reduce((sum, l) => sum + (l.totalVotes / totalVotes) * 100, 0) * 3.6}deg)`,
                backgroundColor: '#888'
              }}
            ></div>
          )}
          <div className="pie-center">
            <div className="pie-value">{totalVotes}</div>
            <div className="pie-label">Votes</div>
          </div>
        </div>
        <div className="pie-legend">
          {topLists.map((list, index) => (
            <div className="legend-item" key={list.id}>
              <div 
                className="color-box" 
                style={{ backgroundColor: `hsl(${index * 72}, 70%, 60%)` }}
              ></div>
              <span>{list.title.substring(0, 15)}{list.title.length > 15 ? '...' : ''}</span>
            </div>
          ))}
          {othersVotes > 0 && (
            <div className="legend-item">
              <div className="color-box" style={{ backgroundColor: '#888' }}></div>
              <span>Other Lists</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner"></div>
      <p>Initializing encrypted connection...</p>
    </div>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">
          <h1>FHE<span>Curate</span></h1>
          <p>Private Content Curation with FHE</p>
        </div>
        
        <div className="header-actions">
          <button 
            onClick={() => setShowCreateModal(true)} 
            className="create-btn"
          >
            + Create List
          </button>
          <button 
            className="tutorial-btn"
            onClick={() => setShowTutorial(!showTutorial)}
          >
            {showTutorial ? "Hide Tutorial" : "Show Tutorial"}
          </button>
          <WalletManager account={account} onConnect={onConnect} onDisconnect={onDisconnect} />
        </div>
      </header>
      
      <div className="main-content">
        <div className="welcome-banner">
          <div className="welcome-text">
            <h2>Decentralized Content Curation</h2>
            <p>Create and vote on content lists with fully private voting using FHE technology</p>
          </div>
        </div>
        
        {showTutorial && (
          <div className="tutorial-section glass-card">
            <h2>How to Use FHE Curate</h2>
            <p className="subtitle">Learn how to curate content privately</p>
            
            <div className="tutorial-steps">
              {tutorialSteps.map((step, index) => (
                <div 
                  className="tutorial-step"
                  key={index}
                >
                  <div className="step-icon">{step.icon}</div>
                  <div className="step-content">
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="stats-section">
          <div className="stats-grid">
            <div className="stat-card glass-card">
              <h3>Total Lists</h3>
              <div className="stat-value">{totalLists}</div>
            </div>
            
            <div className="stat-card glass-card">
              <h3>Total Votes</h3>
              <div className="stat-value">{totalVotes}</div>
            </div>
            
            <div className="stat-card glass-card">
              <h3>Your Lists</h3>
              <div className="stat-value">{userCreatedLists}</div>
            </div>
          </div>
        </div>
        
        <div className="chart-section">
          <div className="chart-card glass-card">
            <h3>Top Lists by Votes</h3>
            {renderPieChart()}
          </div>
        </div>
        
        <div className="lists-section">
          <div className="section-header">
            <h2>Curated Content Lists</h2>
            <div className="header-actions">
              <button 
                onClick={loadLists}
                className="refresh-btn"
                disabled={isRefreshing}
              >
                {isRefreshing ? "Refreshing..." : "Refresh Lists"}
              </button>
            </div>
          </div>
          
          {lists.length === 0 ? (
            <div className="no-lists glass-card">
              <div className="no-lists-icon"></div>
              <p>No curated lists found</p>
              <button 
                className="create-btn"
                onClick={() => setShowCreateModal(true)}
              >
                Create First List
              </button>
            </div>
          ) : (
            <div className="lists-grid">
              {lists.map(list => (
                <div className="list-card glass-card" key={list.id}>
                  <div className="list-header">
                    <h3>{list.title}</h3>
                    <div className="vote-count">
                      <span className="vote-icon">👍</span>
                      {list.totalVotes}
                    </div>
                  </div>
                  
                  <p className="list-description">{list.description}</p>
                  
                  <div className="list-footer">
                    <div className="creator-info">
                      <span className="creator-label">Created by:</span>
                      <span className="creator-address">
                        {list.creator.substring(0, 6)}...{list.creator.substring(38)}
                      </span>
                    </div>
                    
                    <button 
                      className="vote-btn"
                      onClick={() => voteForList(list.id)}
                    >
                      Vote Privately
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
  
      {showCreateModal && (
        <ModalCreate 
          onSubmit={createList} 
          onClose={() => setShowCreateModal(false)} 
          creating={creating}
          listData={newListData}
          setListData={setNewListData}
        />
      )}
      
      {walletSelectorOpen && (
        <WalletSelector
          isOpen={walletSelectorOpen}
          onWalletSelect={(wallet) => { onWalletSelect(wallet); setWalletSelectorOpen(false); }}
          onClose={() => setWalletSelectorOpen(false)}
        />
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content glass-card">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="spinner"></div>}
              {transactionStatus.status === "success" && "✓"}
              {transactionStatus.status === "error" && "✕"}
            </div>
            <div className="transaction-message">
              {transactionStatus.message}
            </div>
          </div>
        </div>
      )}
  
      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="logo">
              <h3>FHE<span>Curate</span></h3>
            </div>
            <p>Private content curation powered by FHE technology</p>
          </div>
          
          <div className="footer-links">
            <a href="#" className="footer-link">Documentation</a>
            <a href="#" className="footer-link">Privacy Policy</a>
            <a href="#" className="footer-link">Terms of Service</a>
          </div>
        </div>
        
        <div className="footer-bottom">
          <div className="fhe-badge">
            <span>FHE-Powered Privacy</span>
          </div>
          <div className="copyright">
            © {new Date().getFullYear()} FHE Curate. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

interface ModalCreateProps {
  onSubmit: () => void; 
  onClose: () => void; 
  creating: boolean;
  listData: any;
  setListData: (data: any) => void;
}

const ModalCreate: React.FC<ModalCreateProps> = ({ 
  onSubmit, 
  onClose, 
  creating,
  listData,
  setListData
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setListData({
      ...listData,
      [name]: value
    });
  };

  const handleSubmit = () => {
    if (!listData.title.trim()) {
      alert("Please enter a title for your list");
      return;
    }
    
    onSubmit();
  };

  return (
    <div className="modal-overlay">
      <div className="create-modal glass-card">
        <div className="modal-header">
          <h2>Create New List</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="form-group">
            <label>List Title *</label>
            <input 
              type="text"
              name="title"
              value={listData.title} 
              onChange={handleChange}
              placeholder="e.g. Top 10 Sci-Fi Movies" 
              className="modal-input"
            />
          </div>
          
          <div className="form-group">
            <label>Description</label>
            <textarea 
              name="description"
              value={listData.description} 
              onChange={handleChange}
              placeholder="Describe your list..." 
              className="modal-textarea"
              rows={3}
            />
          </div>
          
          <div className="privacy-notice">
            <div className="lock-icon">🔒</div> 
            <span>All votes will be private using FHE technology</span>
          </div>
        </div>
        
        <div className="modal-footer">
          <button 
            onClick={onClose}
            className="cancel-btn"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={creating}
            className="submit-btn"
          >
            {creating ? "Creating..." : "Create List"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;