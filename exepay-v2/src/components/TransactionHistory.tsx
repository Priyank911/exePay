// ExePay v2 - Transaction History Component
// Premium dark design

import { motion } from 'framer-motion'
import { useStore } from '../store/useStore'
import '../styles/TransactionHistory.css'

interface Props {
  onBack: () => void
}

const TransactionHistory = ({ onBack }: Props) => {
  const { user } = useStore()

  if (!user) return null

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const groupTransactionsByDate = () => {
    const groups: Record<string, typeof user.transactions> = {}
    
    user.transactions.forEach(txn => {
      const date = new Date(txn.timestamp)
      const key = date.toLocaleDateString('en-IN', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
      
      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(txn)
    })
    
    return groups
  }

  const groupedTransactions = groupTransactionsByDate()

  return (
    <motion.div
      className="history-page"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      {/* Header */}
      <div className="page-header">
        <button className="back-btn" onClick={onBack}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h2 className="page-title">Transaction History</h2>
      </div>

      <div className="history-content">
        {user.transactions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p>No transactions yet</p>
            <span>Your payment history will appear here</span>
          </div>
        ) : (
          <div className="history-list">
            {Object.entries(groupedTransactions).map(([date, transactions], groupIndex) => (
              <div key={date} className="history-group">
                <div className="group-date">{date}</div>
                <div className="group-transactions">
                  {transactions.map((txn, index) => (
                    <motion.div
                      key={txn.id}
                      className="history-item"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: (groupIndex * 0.1) + (index * 0.05) }}
                    >
                      <div className="item-left">
                        <div className={`item-icon ${txn.type}`}>
                          {txn.type === 'credit' ? '↓' : '↑'}
                        </div>
                        <div className="item-info">
                          <span className="item-desc">{txn.description}</span>
                          <span className="item-time">
                            {new Date(txn.timestamp).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>
                      <div className="item-right">
                        <span className={`item-amount ${txn.type}`}>
                          {txn.type === 'credit' ? '+' : '-'}
                          {formatCurrency(txn.amount)}
                        </span>
                        <span className={`item-status ${txn.status}`}>
                          {txn.status}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}

export default TransactionHistory
