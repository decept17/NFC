import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    TouchableWithoutFeedback,
    Keyboard,
    Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/Colours";
import { PillInput } from "@/components/PillInput";
import { PillButton } from "@/components/PillButton";
import { fetchApi } from "@/services/api";
import { useFamily } from "@/context/FamilyContext";

export default function AddChildScreen() {
    const router = useRouter();
    const { refreshAccounts } = useFamily();
    const [name, setName] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(false);

    const handleAddChild = async () => {
        if (!name.trim()) {
            Alert.alert("Missing Name", "Please enter your child's name.");
            return;
        }

        setLoading(true);
        try {
            const response = await fetchApi("/accounts/add-child", {
                method: "POST",
                body: JSON.stringify({ name: name.trim() }),
            });

            // Read raw text first so we never crash on malformed responses
            const rawText = await response.text();
            console.log('[add-child] raw response:', response.status, rawText);

            if (!response.ok) {
                let detail = "Failed to add child";
                try {
                    const errorData = JSON.parse(rawText);
                    detail = errorData.detail || detail;
                } catch { }
                throw new Error(detail);
            }

            let data: any;
            try {
                data = JSON.parse(rawText);
            } catch {
                throw new Error(`Server returned unexpected response: ${rawText.substring(0, 80)}`);
            }

            // Refresh the family accounts in the global context
            await refreshAccounts();

            Alert.alert(
                "Child Added! 🎉",
                `${name.trim()}'s account is ready. You can now top up their balance and link an NFC wristband.`,
                [{ text: "OK", onPress: () => router.back() }]
            );
        } catch (error: any) {
            Alert.alert("Error", error.message || "Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <SafeAreaView style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={28} color={Colors.textWhite} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Add Child</Text>
                    <View style={{ width: 44 }} />
                </View>

                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={styles.inner}
                >
                    <View style={styles.content}>
                        {/* Icon */}
                        <View style={styles.iconContainer}>
                            <Ionicons name="person-add-outline" size={60} color={Colors.textOrange} />
                        </View>

                        <Text style={styles.subtitle}>
                            Enter your child's name to create their account. They'll be given a digital
                            wallet and can be linked to an NFC wristband.
                        </Text>

                        <PillInput
                            placeholder="Child's name (e.g. Oliver)"
                            value={name}
                            onChangeText={setName}
                        />

                        <View style={styles.buttonWrapper}>
                            <PillButton
                                title="Create Account"
                                onPress={handleAddChild}
                                isLoading={loading}
                            />
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </TouchableWithoutFeedback>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.backgroundBlue,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 16,
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: "700",
        color: Colors.textWhite,
    },
    inner: {
        flex: 1,
    },
    content: {
        flex: 1,
        paddingHorizontal: 30,
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
    },
    iconContainer: {
        width: 110,
        height: 110,
        borderRadius: 55,
        backgroundColor: "rgba(255,255,255,0.1)",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 15,
        color: "rgba(255,255,255,0.75)",
        textAlign: "center",
        lineHeight: 22,
    },
    buttonWrapper: {
        width: "60%",
        marginTop: 10,
        alignItems: "center",
        justifyContent: "center",
    },
});
