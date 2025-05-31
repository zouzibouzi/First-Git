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
import CalendarStrip from 'react-native-calendar-strip';
import { format, isWithinInterval, startOfDay, endOfDay, addYears, subYears } from 'date-fns';

export default function BalanceScreen() {
  const { transactions } = useTransactionHistory();
  const [displayCurrency, setDisplayCurrency] = useState<'DZD' | 'USD' | 'EUR'>('DZD');
  const [dateRange, setDateRange] = useState<{
    start: Date | null;
    end: Date | null;
  }>({
    start: null,
    end: null,
  });

  // Get the last used rate for each target currency
  const getLastRate = (targetCurrency: 'EUR' | 'USD') => {
    const lastTransaction = [...transactions]
      .reverse()
      .find(t => t.targetCurrency === targetCurrency);
    return lastTransaction?.rate || null;
  };

  // Filter transactions by date range
  const filteredTransactions = React.useMemo(() => {
    if (!dateRange.start && !dateRange.end) return transactions;

    return transactions.filter(transaction => {
      const transactionDate = new Date(transaction.timestamp);
      
      if (dateRange.start && dateRange.end) {
        return isWithinInterval(transactionDate, {
          start: startOfDay(dateRange.start),
          end: endOfDay(dateRange.end),
        });
      } else if (dateRange.start) {
        return transactionDate >= startOfDay(dateRange.start);
      } else if (dateRange.end) {
        return transactionDate <= endOfDay(dateRange.end);
      }
      
      return true;
    });
  }, [transactions, dateRange]);

  // Calculate balances based on filtered transactions
  const balances = React.useMemo(() => {
    const balanceMap = new Map();

    filteredTransactions.forEach(transaction => {
      const key = transaction.currencyCode;
      const currentBalance = balanceMap.get(key) || {
        buys: 0,
        sells: 0,
        currency: CURRENCIES.find(c => c.code === key),
        lastRateEUR: null,
        lastRateUSD: null,
      };

      const amount = transaction.amount * transaction.rate;

      if (transaction.type === 'buy') {
        currentBalance.buys += amount;
      } else {
        currentBalance.sells += amount;
      }

      // Update last known rates
      if (transaction.targetCurrency === 'EUR') {
        currentBalance.lastRateEUR = transaction.rate;
      } else if (transaction.targetCurrency === 'USD') {
        currentBalance.lastRateUSD = transaction.rate;
      }

      balanceMap.set(key, currentBalance);
    });

    return Array.from(balanceMap.entries()).map(([code, data]) => ({
      code,
      ...data,
      netTotal: data.buys - data.sells,
    }));
  }, [filteredTransactions]);

  // Calculate total net balance across all currencies
  const totalNetBalance = balances.reduce((total, balance) => total + balance.netTotal, 0);

  // Get the last known rate for the current display currency
  const lastRate = getLastRate(displayCurrency === 'USD' ? 'USD' : 'EUR');

  const toggleDisplayCurrency = () => {
    setDisplayCurrency(current => {
      switch (current) {
        case 'DZD': return 'USD';
        case 'USD': return 'EUR';
        case 'EUR': return 'DZD';
      }
    });
  };

  const convertAmount = (amount: number, displayCurrency: 'DZD' | 'USD' | 'EUR') => {
    if (displayCurrency === 'DZD') return amount;
    const rate = getLastRate(displayCurrency);
    return rate ? amount / rate : null;
  };

  const handleDateSelect = (date: Date) => {
    if (!dateRange.start) {
      setDateRange({ start: date, end: null });
    } else if (!dateRange.end && date > dateRange.start) {
      setDateRange(prev => ({ ...prev, end: date }));
    } else {
      setDateRange({ start: date, end: null });
    }
  };

  const clearDateRange = () => {
    setDateRange({ start: null, end: null });
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
            {displayCurrency === 'DZD' 
              ? formatCurrency(item.buys, 'DZD')
              : convertAmount(item.buys, displayCurrency) !== null
                ? formatCurrency(convertAmount(item.buys, displayCurrency), displayCurrency)
                : '-- ' + displayCurrency}
          </Text>
        </View>
        <View style={styles.balanceRow}>
          <Text style={styles.balanceLabel}>Total Sells:</Text>
          <Text style={styles.balanceValue}>
            {displayCurrency === 'DZD'
              ? formatCurrency(item.sells, 'DZD')
              : convertAmount(item.sells, displayCurrency) !== null
                ? formatCurrency(convertAmount(item.sells, displayCurrency), displayCurrency)
                : '-- ' + displayCurrency}
          </Text>
        </View>
        <View style={[styles.balanceRow, styles.netTotalRow]}>
          <Text style={styles.netTotalLabel}>Net Total:</Text>
          <Text style={[
            styles.netTotalValue,
            item.netTotal > 0 ? styles.positive : styles.negative
          ]}>
            {displayCurrency === 'DZD'
              ? formatCurrency(item.netTotal, 'DZD')
              : convertAmount(item.netTotal, displayCurrency) !== null
                ? formatCurrency(convertAmount(item.netTotal, displayCurrency), displayCurrency)
                : '-- ' + displayCurrency}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="Balance Summary" />
      
      {transactions.length > 0 ? (
        <>
          <View style={styles.filtersContainer}>
            <TouchableOpacity 
              style={styles.currencySelector}
              onPress={toggleDisplayCurrency}
            >
              <View>
                <Text style={styles.currencySelectorLabel}>Display Currency:</Text>
                {displayCurrency !== 'DZD' && lastRate && (
                  <Text style={styles.exchangeRate}>
                    1 {displayCurrency} = {lastRate} DZD
                  </Text>
                )}
              </View>
              <View style={styles.currencySelectorButton}>
                <Text style={styles.currencySelectorText}>{displayCurrency}</Text>
                <ArrowRightLeft size={16} color={COLORS.primary} />
              </View>
            </TouchableOpacity>

            <View style={styles.calendarContainer}>
              <View style={styles.calendarHeader}>
                <Text style={styles.calendarTitle}>
                  {dateRange.start
                    ? dateRange.end
                      ? `${format(dateRange.start, 'MMM d')} - ${format(dateRange.end, 'MMM d, yyyy')}`
                      : `From ${format(dateRange.start, 'MMM d, yyyy')}`
                    : 'Select date range'}
                </Text>
                {(dateRange.start || dateRange.end) && (
                  <TouchableOpacity onPress={clearDateRange} style={styles.clearButton}>
                    <Text style={styles.clearButtonText}>Clear</Text>
                  </TouchableOpacity>
                )}
              </View>
              <CalendarStrip
                scrollable
                style={styles.calendar}
                calendarColor={COLORS.cardBackground}
                calendarHeaderStyle={styles.calendarHeaderText}
                dateNumberStyle={styles.calendarDateNumber}
                dateNameStyle={styles.calendarDateName}
                highlightDateNumberStyle={styles.calendarHighlightNumber}
                highlightDateNameStyle={styles.calendarHighlightName}
                disabledDateNameStyle={styles.calendarDisabledName}
                disabledDateNumberStyle={styles.calendarDisabledNumber}
                iconContainer={{ flex: 0.1 }}
                minDate={subYears(new Date(), 1)}
                maxDate={new Date()}
                selectedDate={dateRange.start}
                onDateSelected={handleDateSelect}
                highlightDateContainerStyle={styles.highlightContainer}
              />
            </View>
          </View>

          <View style={styles.totalBalanceCard}>
            <Text style={styles.totalBalanceLabel}>Total Net Balance:</Text>
            <Text style={[
              styles.totalBalanceValue,
              totalNetBalance > 0 ? styles.positive : styles.negative
            ]}>
              {displayCurrency === 'DZD'
                ? formatCurrency(totalNetBalance, 'DZD')
                : convertAmount(totalNetBalance, displayCurrency) !== null
                  ? formatCurrency(convertAmount(totalNetBalance, displayCurrency), displayCurrency)
                  : '-- ' + displayCurrency}
            </Text>
          </View>

          {balances.length > 0 ? (
            <FlatList
              data={balances}
              renderItem={renderBalanceItem}
              keyExtractor={item => item.code}
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <EmptyState
              title="No transactions found"
              description="No transactions exist for the selected date range"
              icon="history"
            />
          )}
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
  filtersContainer: {
    backgroundColor: COLORS.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  currencySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  currencySelectorLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  exchangeRate: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
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
  calendarContainer: {
    paddingVertical: 12,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  calendarTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 14,
    color: COLORS.text,
  },
  clearButton: {
    backgroundColor: COLORS.error + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  clearButtonText: {
    fontFamily: 'Inter-Bold',
    fontSize: 14,
    color: COLORS.error,
  },
  calendar: {
    height: 100,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  calendarHeaderText: {
    fontFamily: 'Inter-Bold',
    color: COLORS.text,
  },
  calendarDateNumber: {
    fontFamily: 'Inter-Regular',
    color: COLORS.text,
  },
  calendarDateName: {
    fontFamily: 'Inter-Regular',
    color: COLORS.textSecondary,
  },
  calendarHighlightNumber: {
    fontFamily: 'Inter-Bold',
    color: COLORS.cardBackground,
  },
  calendarHighlightName: {
    fontFamily: 'Inter-Regular',
    color: COLORS.cardBackground,
  },
  calendarDisabledName: {
    fontFamily: 'Inter-Regular',
    color: COLORS.textSecondary + '50',
  },
  calendarDisabledNumber: {
    fontFamily: 'Inter-Regular',
    color: COLORS.textSecondary + '50',
  },
  highlightContainer: {
    backgroundColor: COLORS.primary,
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