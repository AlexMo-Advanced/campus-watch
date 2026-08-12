import React from 'react';
import {
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  componentDidCatch(error, errorInfo) {
    // Catch errors in any components below and re-render with error message
    this.setState({
      hasError: true,
      error: error,
      errorInfo: errorInfo,
    });
    
    // Log to console as well
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>🚨 APK Crash Caught!</Text>
            <Text style={styles.subtitle}>
              An unhandled exception occurred in the release build:
            </Text>
          </View>

          {/* Error Message Box */}
          <View style={styles.errorBox}>
            <Text style={styles.errorLabel}>Error:</Text>
            <Text style={styles.errorText}>
              {this.state.error?.toString() || 'Unknown Error'}
            </Text>
          </View>

          {/* Stack Trace Scroll Area */}
          <Text style={styles.stackLabel}>Component Stack Trace:</Text>
          <ScrollView style={styles.stackBox}>
            <Text style={styles.stackText}>
              {this.state.errorInfo?.componentStack || 'No stack available'}
            </Text>
          </ScrollView>

          {/* Recovery Button */}
          <TouchableOpacity style={styles.resetBtn} onPress={this.handleReset}>
            <Text style={styles.resetBtnText}>Dismiss & Try Again</Text>
          </TouchableOpacity>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 20,
  },
  header: {
    marginTop: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ef4444',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
  },
  errorBox: {
    backgroundColor: '#450a0a',
    borderColor: '#991b1b',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fca5a5',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  errorText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fef2f2',
  },
  stackLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  stackBox: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  stackText: {
    fontSize: 11,
    color: '#cbd5e1',
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  resetBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  resetBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
});

export default ErrorBoundary;