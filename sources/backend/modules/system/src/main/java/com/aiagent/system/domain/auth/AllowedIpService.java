// @feat FEAT-501
package com.aiagent.system.domain.auth;

import com.aiagent.domain.user.entity.SysUserIpAllow;
import com.aiagent.domain.user.repository.SysUserIpAllowRepository;
import com.aiagent.support.time.BusinessCalendar;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.time.LocalDate;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 사용자의 활성 접속 대역이 요청 IP를 허용하는지 판정한다. */
@Service
@Transactional(readOnly = true)
public class AllowedIpService {

    private final SysUserIpAllowRepository repository;
    private final BusinessCalendar calendar;

    public AllowedIpService(SysUserIpAllowRepository repository, BusinessCalendar calendar) {
        this.repository = repository;
        this.calendar = calendar;
    }

    public boolean isAllowed(String userId, String clientIp) {
        List<SysUserIpAllow> rows = repository.findByUserIdOrderByIpCidrAsc(userId);
        if (rows.isEmpty()) {
            return true;
        }
        LocalDate today = calendar.today();
        return rows.stream()
                .filter(row -> isActive(row, today))
                .anyMatch(row -> contains(row.getIpCidr(), clientIp));
    }

    private static boolean isActive(SysUserIpAllow row, LocalDate today) {
        return Boolean.TRUE.equals(row.getUseYn())
                && (row.getValidFromDt() == null || !today.isBefore(row.getValidFromDt()))
                && (row.getValidToDt() == null || !today.isAfter(row.getValidToDt()));
    }

    static boolean contains(String range, String clientIp) {
        if (range == null || clientIp == null) {
            return false;
        }
        String[] parts = range.split("/", -1);
        if (parts.length > 2) {
            return false;
        }
        try {
            byte[] network = literal(parts[0]).getAddress();
            byte[] client = literal(clientIp).getAddress();
            if (network.length != client.length) {
                return false;
            }
            int prefix = parts.length == 1 ? network.length * Byte.SIZE : Integer.parseInt(parts[1]);
            if (prefix < 0 || prefix > network.length * Byte.SIZE) {
                return false;
            }
            for (int index = 0; index < network.length; index++) {
                int remaining = prefix - index * Byte.SIZE;
                int mask = remaining >= Byte.SIZE
                        ? 0xff
                        : remaining <= 0 ? 0 : 0xff << (Byte.SIZE - remaining);
                if ((network[index] & mask) != (client[index] & mask)) {
                    return false;
                }
            }
            return true;
        } catch (IllegalArgumentException | UnknownHostException ignored) {
            return false;
        }
    }

    private static InetAddress literal(String value) throws UnknownHostException {
        if (value.contains(":")) {
            return InetAddress.getByName(value);
        }
        String[] octets = value.split("\\.", -1);
        if (octets.length != 4) {
            throw new UnknownHostException(value);
        }
        byte[] bytes = new byte[4];
        for (int index = 0; index < octets.length; index++) {
            int octet = Integer.parseInt(octets[index]);
            if (octet < 0 || octet > 255) {
                throw new UnknownHostException(value);
            }
            bytes[index] = (byte) octet;
        }
        return InetAddress.getByAddress(bytes);
    }
}
