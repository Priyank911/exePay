package com.exepay.app.ui.dashboard

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.exepay.app.R
import com.exepay.app.data.PaymentRequest
import com.exepay.app.data.PaymentStatus
import com.exepay.app.databinding.ItemPaymentBinding
import java.text.SimpleDateFormat
import java.util.Locale

class PaymentsAdapter(
    private val onItemClick: (PaymentRequest) -> Unit
) : ListAdapter<PaymentRequest, PaymentsAdapter.PaymentViewHolder>(PaymentDiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): PaymentViewHolder {
        val binding = ItemPaymentBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return PaymentViewHolder(binding)
    }

    override fun onBindViewHolder(holder: PaymentViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    inner class PaymentViewHolder(
        private val binding: ItemPaymentBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(payment: PaymentRequest) {
            // Merchant initial
            val initial = payment.name.firstOrNull()?.uppercaseChar() ?: '?'
            binding.merchantInitial.text = initial.toString()

            // Merchant name
            binding.merchantName.text = payment.name

            // Amount
            val formattedAmount = "₹${String.format("%,.0f", payment.amount)}"
            binding.amount.text = formattedAmount

            // Status
            binding.statusChip.text = payment.status.name.lowercase()
                .replaceFirstChar { it.uppercase() }
            
            // Status color
            val statusColor = payment.getStatusColor()
            binding.statusChip.setTextColor(statusColor)
            binding.statusIndicator.setColorFilter(statusColor)

            // Time
            val timeFormat = SimpleDateFormat("h:mm a", Locale.getDefault())
            binding.time.text = timeFormat.format(payment.createdAt)

            // Click listener
            if (payment.status != PaymentStatus.COMPLETED && payment.status != PaymentStatus.FAILED) {
                binding.root.setOnClickListener { onItemClick(payment) }
                binding.root.alpha = 1f
            } else {
                binding.root.setOnClickListener(null)
                binding.root.alpha = 0.6f
            }
        }
    }

    class PaymentDiffCallback : DiffUtil.ItemCallback<PaymentRequest>() {
        override fun areItemsTheSame(old: PaymentRequest, new: PaymentRequest) = old.id == new.id
        override fun areContentsTheSame(old: PaymentRequest, new: PaymentRequest) = old == new
    }
}
