import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';

const screenOptions = {
  headerShown: false,
};

export default function TabsLayout() {
  return (
    <Tabs screenOptions={screenOptions} initialRouteName="fridge/index">
      <Tabs.Screen
        name="fridge/index"
        options={{
          title: 'Fridge',
          tabBarIcon: ({ color, size }) => <FontAwesome name="home" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="planner/index"
        options={{
          title: 'Planner',
          tabBarIcon: ({ color, size }) => <FontAwesome name="calendar" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="marmicon/index"
        options={{
          title: 'Marmicon',
          tabBarIcon: ({ color, size }) => <FontAwesome name="cutlery" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
