import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '@/components/Header';
import { COLORS } from '@/constants/Colors';
import { useTransactionHistory } from '@/hooks/useTransactionHistory';
import { formatCurrency } from '@/utils/formatters';
import { CURRENCIES } from '@/data/currencies';
import EmptyState from '@/components/EmptyState';
import { ArrowRightLeft } from 'lucide-react-native';

// Exchange rates for conversion (you would typically get these from an API)
const EXCHANGE_RATES = {
  EUR: {
    USD: 1.09,
    DZD: 147.50
  },
  USD: {
    EUR: 0.92,
    DZD: 135.50
  },
  DZD: {
    EUR: 0.00678,
    USD: 0.00738
  }
};

export default function BalanceScreen() {
  const { transactions } = useTransactionHistory();
  const [displayCurrency, setDisplayCurrency] = useState<'DZD' | 'USD' | 'EUR'>('DZD');

  // Function to convert between currencies
  const convertCurrency = (amount: number, from: string, to: string): number => {
    if (from === to) return amount;
    if (from === 'DZD') {
      return amount * EXCHANGE_RATES.DZD[to];
    } else if (to === 'DZD') {
      return amount * EXCHANGE_RATES[from].DZD;
    } else {
      // First convert to DZD, then to target currency
      const inDZD = amount * EXCHANGE_RATES[from].DZD;
      return inDZD * EXCHANGE_RATES.DZD[to];
    }
  };

  // Calculate balance for each currency
  const balances = React.useMemo(() => {
    const balanceMap = new Map();

    transactions.forEach(transaction => {
      const key = transaction.currencyCode;
      const currentBalance = balanceMap.get(key) || {
        buys: 0,
        sells: 0,
        currency: CURRENCIES.find(c => c.code === key),
      };

      // Convert all amounts to the selected display currency
      const amountInDisplayCurrency = convertCurrency(
        transaction.amount * transaction.rate,
        'DZD',
        displayCurrency
      );

      if (transaction.type === 'buy') {
        currentBalance.buys += amountInDisplayCurrency;
      } else {
        currentBalance.sells += amountInDisplayCurrency;
      }

      balanceMap.set(key, currentBalance);
    });

    return Array.from(balanceMap.entries()).map(([code, data]) => ({
      code,
      ...data,
      netTotal: data.buys - data.sells,
    }));
  }, [transactions, displayCurrency]);

  // Calculate total net balance across all currencies
  const totalNetBalance = balances.reduce((total, balance) => total + balance.netTotal, 0);

  const toggleDisplayCurrency = () => {
    setDisplayCurrency(current => {
      switch (current) {
        case 'DZD': return 'USD';
        case 'USD': return 'EUR';
        case 'EUR': return 'DZD';
      }
    });
  };

  const renderBalanceItem = ({ item }) => (
    <View style={styles.balanceItem}>
      <View style={styles.currencyInfo}>
        <Image source={{ uri: item.currency.flagUrl }} style={styles.flag} />
        <View style={styles.currencyDetails}>
          <Text style={styles.currencyName}>{item.currency.name}</Text>
          <Text style={styles.currencyCode}>{item.code}</Text>
        </View>
      </View>
      <View style={styles.balanceDetails}>
        <View style={styles.balanceRow}>
          <Text style={styles.balanceLabel}>Total Buys:</Text>
          <Text style={styles.balanceValue}>
            {formatCurrency(item.buys, displayCurrency)}
          </Text>
        </View>
        <View style={styles.balanceRow}>
          <Text style={styles.balanceLabel}>Total Sells:</Text>
          <Text style={styles.balanceValue}>
            {formatCurrency(item.sells, displayCurrency)}
          </Text>
        </View>
        <View style={[styles.balanceRow, styles.netTotalRow]}>
          <Text style={styles.netTotalLabel}>Net Total:</Text>
          <Text style={[
            styles.netTotalValue,
            item.netTotal > 0 ? styles.positive : styles.negative
          ]}>
            {formatCurrency(item.netTotal, displayCurrency)}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="Balance Summary" />
      
      {balances.length > 0 ? (
        <>
          <TouchableOpacity 
            style={styles.currencySelector}
            onPress={toggleDisplayCurrency}
          >
            <Text style={styles.currencySelectorLabel}>Display Currency:</Text>
            <View style={styles.currencySelectorButton}>
              <Text style={styles.currencySelectorText}>{displayCurrency}</Text>
              <ArrowRightLeft size={16} color={COLORS.primary} />
            </View>
          </TouchableOpacity>

          <View style={styles.totalBalanceCard}>
            <Text style={styles.totalBalanceLabel}>Total Net Balance:</Text>
            <Text style={[
              styles.totalBalanceValue,
              totalNetBalance > 0 ? styles.positive : styles.negative
            ]}>
              {formatCurrency(totalNetBalance, displayCurrency)}
            </Text>
          </View>

          <FlatList
            data={balances}
            renderItem={renderBalanceItem}
            keyExtractor={item => item.code}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          />
        </>
      ) : (
        <EmptyState
          title="No transactions yet"
          description="Your balance summary will appear here once you make transactions"
          icon="history"
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  currencySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.cardBackground,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  currencySelectorLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  currencySelectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 8,
  },
  currencySelectorText: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: COLORS.primary,
  },
  totalBalanceCard: {
    backgroundColor: COLORS.cardBackground,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  totalBalanceLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  totalBalanceValue: {
    fontFamily: 'Poppins-Bold',
    fontSize: 24,
    color: COLORS.text,
  },
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  balanceItem: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  currencyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  flag: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  currencyDetails: {
    marginLeft: 12,
  },
  currencyName: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: COLORS.text,
  },
  currencyCode: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  balanceDetails: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 8,
    padding: 12,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  balanceLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  balanceValue: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: COLORS.text,
  },
  netTotalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginBottom: 0,
  },
  netTotalLabel: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: COLORS.text,
  },
  netTotalValue: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
  },
  positive: {
    color: COLORS.success,
  },
  negative: {
    color: COLORS.error,
  },
});