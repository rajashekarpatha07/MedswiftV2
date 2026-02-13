import { Link } from 'react-router-dom';
import { Container, Title, Text, SimpleGrid, Card, Group, ThemeIcon, Badge, Box } from '@mantine/core';

const roles = [
    {
        to: '/user/login',
        icon: '👤',
        title: 'Patient',
        desc: 'Request emergency ambulance service instantly',
        color: 'blue',
        gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    },
    {
        to: '/ambulance/login',
        icon: '🚑',
        title: 'Ambulance Driver',
        desc: 'Accept and manage trip requests in real-time',
        color: 'teal',
        gradient: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)'
    },
    {
        to: '/hospital/login',
        icon: '🏥',
        title: 'Hospital',
        desc: 'Manage inventory, beds and blood stock',
        color: 'violet',
        gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    },
    {
        to: '/admin/login',
        icon: '⚙️',
        title: 'Admin',
        desc: 'Monitor and control system operations',
        color: 'orange',
        gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
    }
];

function LandingPage() {
    return (
        <Box style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Animated background elements */}
            <Box style={{
                position: 'absolute',
                top: '10%',
                left: '10%',
                width: '300px',
                height: '300px',
                background: 'radial-gradient(circle, rgba(255,107,107,0.2) 0%, transparent 70%)',
                borderRadius: '50%',
                filter: 'blur(40px)',
            }} className="animate-float" />
            <Box style={{
                position: 'absolute',
                bottom: '20%',
                right: '15%',
                width: '400px',
                height: '400px',
                background: 'radial-gradient(circle, rgba(102,126,234,0.2) 0%, transparent 70%)',
                borderRadius: '50%',
                filter: 'blur(60px)',
            }} />

            <Container size="lg" py={80} style={{ position: 'relative', zIndex: 1 }}>
                {/* Hero Section */}
                <Box ta="center" mb={60}>
                    <Badge
                        size="lg"
                        variant="gradient"
                        gradient={{ from: 'red', to: 'pink' }}
                        mb="md"
                    >
                        Emergency Response System
                    </Badge>

                    <Title
                        order={1}
                        size={56}
                        fw={800}
                        style={{
                            color: 'white',
                            letterSpacing: '-1px',
                            lineHeight: 1.1
                        }}
                        mb="md"
                    >
                        <span style={{ display: 'block' }}>🚑 MedSwift</span>
                    </Title>

                    <Text
                        size="xl"
                        c="dimmed"
                        maw={500}
                        mx="auto"
                        style={{ color: 'rgba(255,255,255,0.7)' }}
                    >
                        Real-Time Emergency Dispatch & Medical Coordination Platform.
                        When every second counts.
                    </Text>
                </Box>

                {/* Role Selection Cards */}
                <Title order={2} ta="center" c="white" mb="xl" fw={600}>
                    Select Your Role
                </Title>

                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
                    {roles.map((role) => (
                        <Card
                            key={role.to}
                            component={Link}
                            to={role.to}
                            padding="xl"
                            radius="lg"
                            className="card-hover glass"
                            style={{
                                textDecoration: 'none',
                                border: '1px solid rgba(255,255,255,0.1)',
                                cursor: 'pointer',
                                overflow: 'hidden',
                                position: 'relative'
                            }}
                        >
                            {/* Gradient accent bar */}
                            <Box
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    height: '4px',
                                    background: role.gradient
                                }}
                            />

                            <Group>
                                <ThemeIcon
                                    size={60}
                                    radius="xl"
                                    variant="gradient"
                                    gradient={{ from: role.color, to: role.color === 'blue' ? 'violet' : role.color === 'teal' ? 'green' : role.color }}
                                >
                                    <span style={{ fontSize: '28px' }}>{role.icon}</span>
                                </ThemeIcon>

                                <Box>
                                    <Text fw={700} size="lg" c="dark">
                                        {role.title}
                                    </Text>
                                    <Text size="sm" c="dimmed">
                                        {role.desc}
                                    </Text>
                                </Box>
                            </Group>
                        </Card>
                    ))}
                </SimpleGrid>

                {/* Footer */}
                <Text ta="center" mt={60} c="dimmed" size="sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    © 2026 MedSwift • Rapid Response, Better Outcomes
                </Text>
            </Container>
        </Box>
    );
}

export default LandingPage;
